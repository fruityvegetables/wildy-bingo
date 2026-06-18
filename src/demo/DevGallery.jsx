import { Link } from 'react-router-dom';
import { demoPages } from './fixtures.js';
import { isDemoMode } from '../lib/config.js';

export default function DevGallery() {
  return (
    <div className="app-shell">
      <header className="app-header stone-panel">
        <div className="header-brand">
          <span className="skull-icon" aria-hidden="true">
            ☠
          </span>
          <div>
            <h1>Page Gallery</h1>
            <p className="header-tagline">Demo mode · no Supabase required</p>
          </div>
        </div>
      </header>

      <main className="dev-gallery">
        <p className="hint">
          Preview every screen with mock data. Run via <code>npm run dev:demo</code>.
        </p>
        <ul className="dev-page-list">
          {demoPages.map((page) => (
            <li key={page.path}>
              <Link to={page.path} className="dev-page-link stone-panel">
                <span className="dev-page-label">{page.label}</span>
                <span className="dev-page-desc">{page.description}</span>
                <code className="dev-page-path">{page.path}</code>
              </Link>
            </li>
          ))}
        </ul>
        {!isDemoMode() && (
          <p className="form-message error">
            Demo routes work best with <code>npm run dev:demo</code>.
          </p>
        )}
      </main>
    </div>
  );
}
