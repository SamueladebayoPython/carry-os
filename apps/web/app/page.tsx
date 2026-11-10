"use client";

import { useEffect, useRef } from "react";
import { mountCarry } from "../src/carry";

export default function Page() {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!root.current) return;
    return mountCarry(root.current);
  }, []);

  return <div id="app" ref={root} />;
}
