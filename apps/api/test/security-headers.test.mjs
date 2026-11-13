import assert from "node:assert/strict";
import test from "node:test";

import { createApp } from "../dist/bootstrap.js";

async function startApp(t) {
  const app = await createApp({ logger: false });
  await app.listen(0, "127.0.0.1");

  t.after(async () => {
    await app.close();
  });

  const address = app.getHttpServer().address();
  assert.equal(typeof address, "object");
  assert.notEqual(address, null);

  return { baseUrl: `http://127.0.0.1:${address.port}` };
}

function getDirective(contentSecurityPolicy, name) {
  return (
    contentSecurityPolicy
      .split(";")
      .map((directive) => directive.trim())
      .find(
        (directive) =>
          directive === name || directive.startsWith(`${name} `),
      ) ?? ""
  );
}

test("GET /api/health returns the expected Helmet security headers", async (t) => {
  const { baseUrl } = await startApp(t);
  const response = await fetch(`${baseUrl}/api/health`);

  assert.equal(response.status, 200);

  const expectedHeaders = {
    "cross-origin-opener-policy": "same-origin",
    "cross-origin-resource-policy": "same-origin",
    "origin-agent-cluster": "?1",
    "referrer-policy": "no-referrer",
    "x-content-type-options": "nosniff",
    "x-dns-prefetch-control": "off",
    "x-download-options": "noopen",
    "x-frame-options": "SAMEORIGIN",
    "x-permitted-cross-domain-policies": "none",
    "x-xss-protection": "0",
  };

  for (const [header, value] of Object.entries(expectedHeaders)) {
    assert.equal(response.headers.get(header), value, header);
  }

  assert.match(
    response.headers.get("strict-transport-security") ?? "",
    /^max-age=\d+/,
  );
  assert.equal(response.headers.get("x-powered-by"), null);

  const csp = response.headers.get("content-security-policy");
  assert.ok(csp, "health response must include a CSP");

  assert.equal(getDirective(csp, "default-src"), "default-src 'self'");
  assert.equal(getDirective(csp, "script-src"), "script-src 'self'");
  assert.equal(getDirective(csp, "object-src"), "object-src 'none'");
  assert.equal(
    getDirective(csp, "frame-ancestors"),
    "frame-ancestors 'self'",
  );
  assert.equal(
    getDirective(csp, "upgrade-insecure-requests"),
    "upgrade-insecure-requests",
  );
});

test("GET /api/docs serves HTML with a separate Swagger-safe CSP", async (t) => {
  const { baseUrl } = await startApp(t);
  const response = await fetch(`${baseUrl}/api/docs`);
  const html = await response.text();

  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /text\/html/);

  const csp = response.headers.get("content-security-policy");
  assert.ok(csp, "docs response must include a CSP");

  const scriptSrc = getDirective(csp, "script-src");
  const styleSrc = getDirective(csp, "style-src");
  const imgSrc = getDirective(csp, "img-src");

  assert.equal(getDirective(csp, "default-src"), "default-src 'self'");
  assert.match(scriptSrc, /'self'/);
  assert.doesNotMatch(scriptSrc, /'unsafe-inline'/);
  assert.match(styleSrc, /'self'/);
  assert.match(styleSrc, /'unsafe-inline'/);
  assert.match(imgSrc, /'self'/);
  assert.equal(
    getDirective(csp, "upgrade-insecure-requests"),
    "",
    "docs CSP must not upgrade same-origin assets when served over local HTTP",
  );

  // Swagger's HTML contains inline style blocks, but its scripts are external.
  assert.match(html, /<style[\s>]/);
  assert.doesNotMatch(html, /<script(?![^>]*\bsrc=)[^>]*>/i);
});

test("Swagger UI assets and OpenAPI document are served without blocking", async (t) => {
  const { baseUrl } = await startApp(t);
  const docsResponse = await fetch(`${baseUrl}/api/docs`);
  const html = await docsResponse.text();

  const assetPaths = [
    ...new Set(
      [...html.matchAll(/(?:src|href)=['"]([^'"]+)['"]/g)].map(
        (match) => match[1],
      ),
    ),
  ].filter((path) => /\.(?:css|js|png)$/i.test(path));

  assert.ok(
    assetPaths.some((path) => path.endsWith("swagger-ui.css")),
    "Swagger UI stylesheet must be referenced",
  );
  assert.ok(
    assetPaths.some((path) => path.endsWith("swagger-ui-bundle.js")),
    "Swagger UI bundle must be referenced",
  );
  assert.ok(
    assetPaths.some((path) => path.endsWith("swagger-ui-init.js")),
    "Swagger UI init script must be referenced",
  );

  for (const assetPath of assetPaths) {
    const assetUrl = new URL(assetPath, docsResponse.url);
    assert.equal(assetUrl.origin, new URL(baseUrl).origin);

    const assetResponse = await fetch(assetUrl);
    assert.equal(assetResponse.status, 200, `${assetPath} must be served`);
  }

  const specResponse = await fetch(`${baseUrl}/api/docs-json`);
  assert.equal(specResponse.status, 200);
  assert.match(
    specResponse.headers.get("content-type") ?? "",
    /application\/json/,
  );
});
