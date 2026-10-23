import Link from 'next/link';

const modules = [
  'Static analysis',
  'Dependency risk',
  'Secret detection',
  'Infrastructure security',
  'Quality gates',
  'Compliance evidence',
];

export default function HomePage() {
  return (
    <main>
      <nav aria-label="Primary">
        <Link className="brand" href="/">
          ∞ <span>Infinity CodeGuard</span>
        </Link>
        <a className="nav-link" href="http://localhost:4000/api/docs">
          API documentation
        </a>
      </nav>
      <section className="hero">
        <p className="eyebrow">OPEN-SOURCE DEVSECOPS GOVERNANCE</p>
        <h1>Security findings you can trace, govern, and act on.</h1>
        <p className="lede">
          A secure foundation for continuous analysis. Scanner execution remains disabled until each
          adapter passes real parsing and isolation tests.
        </p>
        <div className="actions">
          <a className="primary" href="http://localhost:4000/api/docs">
            Explore the API
          </a>
          <a className="secondary" href="https://github.com/Infinity-Innovations">
            View source
          </a>
        </div>
      </section>
      <section className="grid" aria-label="Platform capabilities">
        {modules.map((name, index) => (
          <article key={name}>
            <span>0{index + 1}</span>
            <h2>{name}</h2>
            <p>Foundation planned; results appear only after validated integrations are enabled.</p>
          </article>
        ))}
      </section>
    </main>
  );
}
