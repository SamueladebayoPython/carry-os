import { PLANNED_NETWORKS } from "@carry-os/shared";

const workflow = [
  "Authenticate with NEAR.",
  "Connect the external wallet that holds the asset.",
  "Discover NFTs across supported chains.",
  "Select an NFT and authorise its deposit.",
  "Move the NFT into the chain-specific carry vault.",
  "Verify custody using on-chain evidence.",
  "Disconnect the original wallet.",
  "Connect a replacement wallet and prove ownership.",
  "Change the beneficiary without moving the NFT out of custody.",
  "Withdraw to the currently authorised beneficiary.",
];

export default function HomePage() {
  return (
    <main className="page">
      <div className="shell">
        <header className="hero">
          <p className="eyebrow">Repository foundation</p>
          <h1>carry os</h1>
          <p className="lede">
            A multichain digital asset custody and utility-preservation
            platform. Assets are intended to remain in chain-specific custody
            while ownership and beneficiary rights are verified on chain.
          </p>
          <div className="notice" role="status">
            <strong>Implementation status:</strong> foundation only. No wallet
            authentication, NFT discovery, custody operation, or network
            integration is implemented yet.
          </div>
        </header>

        <section aria-labelledby="networks-heading">
          <div className="section-heading">
            <h2 id="networks-heading">Planned networks</h2>
            <span className="pill">Testnet-first</span>
          </div>
          <p className="section-copy">
            Every network starts as planned. A network is not implemented until
            its integration and tests are complete.
          </p>
          <ul className="network-grid">
            {PLANNED_NETWORKS.map((network) => (
              <li className="card" key={network.id}>
                <div className="card-top">
                  <h3>{network.name}</h3>
                  <span className="status">Planned</span>
                </div>
                <p>{network.notes}</p>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="workflow-heading" className="split">
          <div>
            <h2 id="workflow-heading">Intended product workflow</h2>
            <p className="section-copy">
              The workflow below describes the product direction. It is not an
              implementation claim.
            </p>
          </div>
          <ol className="workflow">
            {workflow.map((step, index) => (
              <li key={step}>
                <span aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
                {step}
              </li>
            ))}
          </ol>
        </section>

        <footer className="footer">
          <span>carry os foundation</span>
          <span>No network integration is live.</span>
        </footer>
      </div>
    </main>
  );
}
