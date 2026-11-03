/** Switch between the UNO referee and Imposter. */
export function GameTabs({ active }: { active: 'uno' | 'imposter' }) {
  return (
    <nav className="game-tabs" aria-label="Games">
      <a href="#/" className={active === 'uno' ? 'on' : ''} aria-current={active === 'uno' ? 'page' : undefined}>
        UNO referee
      </a>
      <a href="#/imposter" className={active === 'imposter' ? 'on' : ''} aria-current={active === 'imposter' ? 'page' : undefined}>
        Imposter <span className="new-pill">NEW</span>
      </a>
    </nav>
  );
}
