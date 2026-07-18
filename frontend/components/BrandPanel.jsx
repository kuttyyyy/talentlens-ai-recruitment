// BrandPanel.jsx
// The left-side visual shown on auth pages. This is our signature visual —
// concentric "focus rings," like a camera lens finding focus — representing
// the AI narrowing in on the right match between candidate and job.

function BrandPanel() {
  return (
    <div className="hidden md:flex md:w-1/2 bg-ink relative overflow-hidden flex-col justify-between p-12">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[420px] h-[420px] rounded-full bg-gold/10 blur-3xl" />

      <svg
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
        width="420"
        height="420"
        viewBox="0 0 420 420"
        fill="none"
      >
        <circle cx="210" cy="210" r="200" stroke="#F0A857" strokeOpacity="0.15" strokeWidth="1" />
        <circle cx="210" cy="210" r="150" stroke="#F0A857" strokeOpacity="0.25" strokeWidth="1" />
        <circle cx="210" cy="210" r="100" stroke="#F0A857" strokeOpacity="0.4" strokeWidth="1.5" />
        <circle cx="210" cy="210" r="55" stroke="#F0A857" strokeOpacity="0.7" strokeWidth="2" />
      </svg>

      <div className="relative z-10">
        <p className="font-display text-3xl text-text tracking-tight">TalentLens</p>
      </div>

      <div className="relative z-10 max-w-sm">
        <p className="font-display text-4xl text-text leading-tight mb-4">
          AI that sees the whole candidate.
        </p>
        <p className="text-muted text-sm leading-relaxed">
          Every resume read, every score calculated, every recommendation
          explained — in plain language, with the reasoning always visible.
        </p>
      </div>

      <div className="relative z-10 flex gap-6 text-xs text-muted font-mono">
        <span>SKILLS</span>
        <span>·</span>
        <span>EDUCATION</span>
        <span>·</span>
        <span>EXPERIENCE</span>
      </div>
    </div>
  );
}

export default BrandPanel;