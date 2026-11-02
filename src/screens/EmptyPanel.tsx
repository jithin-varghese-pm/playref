/** Laptop only: the right-hand panel before any fight is picked. */
export function EmptyPanel() {
  return (
    <section className="screen panel empty-panel" aria-label="Verdict area">
      <div className="card-stage">
        <div className="face-down" aria-hidden="true">
          <div className="face-down-inner">?</div>
        </div>
      </div>
      <p className="empty-text">Ask the AI referee on the left, or tap a common fight. The verdict lands here.</p>
    </section>
  );
}
