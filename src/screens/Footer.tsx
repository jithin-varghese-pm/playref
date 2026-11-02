import { LINKS } from '../lib/links';
import { setReportContext } from '../lib/reportContext';

export function Footer({ showAccuracy = false }: { showAccuracy?: boolean }) {
  return (
    <footer className="footer">
      {showAccuracy && (
        <div className="footer-row">
          <a href="#/about" className="footer-link">
            How Playref was built
          </a>
          <a href="#/accuracy" className="footer-link">
            How accurate is it?
          </a>
        </div>
      )}
      <a href="#/report" className="footer-link report-link" onClick={() => setReportContext(null)}>
        Report a bug or suggest an idea
      </a>
      <p className="credit">
        Built by <strong>Jithin Varghese</strong>
        <span aria-hidden="true"> · </span>
        <a href={LINKS.portfolio} target="_blank" rel="noopener">
          Portfolio
        </a>
        <span aria-hidden="true"> · </span>
        <a href={LINKS.linkedin} target="_blank" rel="noopener">
          LinkedIn
        </a>
        <span aria-hidden="true"> · </span>
        <a href={LINKS.code} target="_blank" rel="noopener">
          Code
        </a>
      </p>
      <p>Unofficial fan project. UNO is a trademark of Mattel. Not affiliated with or endorsed by Mattel.</p>
    </footer>
  );
}
