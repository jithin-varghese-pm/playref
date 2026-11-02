export function Footer({ showAccuracy = false }: { showAccuracy?: boolean }) {
  return (
    <footer className="footer">
      {showAccuracy && (
        <a href="#/accuracy" className="footer-link">
          How accurate is Playref?
        </a>
      )}
      <p>Unofficial fan project. UNO is a trademark of Mattel. Not affiliated with or endorsed by Mattel.</p>
    </footer>
  );
}
