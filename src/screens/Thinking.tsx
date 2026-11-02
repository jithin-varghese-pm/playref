export function Thinking({ embedded = false }: { embedded?: boolean }) {
  const Tag = embedded ? 'section' : 'main';
  return (
    <Tag className={`screen thinking${embedded ? ' panel' : ''}`}>
      <div className="shuffle" aria-hidden="true">
        <div className="shuffle-card sl" style={{ background: '#141414' }} />
        <div className="shuffle-card sr" style={{ background: '#F3EFE0' }} />
        <div className="shuffle-card sc" style={{ background: '#F5E642' }}>
          ?
        </div>
      </div>
      <div role="status" className="thinking-text">
        <div className="display">
          Checking the rules<span className="dot1">.</span>
          <span className="dot2">.</span>
          <span className="dot3">.</span>
        </div>
        <div className="sub">Reading the Classic rules for you</div>
      </div>
    </Tag>
  );
}
