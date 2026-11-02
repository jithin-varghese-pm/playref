export function Thinking({ embedded = false }: { embedded?: boolean }) {
  const Tag = embedded ? 'section' : 'main';
  return (
    <Tag className={`screen thinking${embedded ? ' panel' : ''}`}>
      <div className="shuffle" aria-hidden="true">
        <div className="shuffle-card sl" style={{ background: '#0067B1' }} />
        <div className="shuffle-card sr" style={{ background: '#00A651' }} />
        <div className="shuffle-card sc" style={{ background: '#FFD100' }}>
          ?
        </div>
      </div>
      <div role="status" className="thinking-text">
        <div className="display">
          Checking the rules<span className="dot1">.</span>
          <span className="dot2">.</span>
          <span className="dot3">.</span>
        </div>
        <div className="sub">The AI referee is reading the Classic rules</div>
      </div>
    </Tag>
  );
}
