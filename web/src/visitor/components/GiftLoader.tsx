export function GiftLoader({ full, label }: { full?: boolean; label?: string }) {
  return (
    <div className={`flex flex-col items-center justify-center gap-3 ${full ? 'min-h-[100dvh] gift-bg' : 'py-16'}`} role="status" aria-live="polite">
      <div className="relative h-16 w-16">
        <span className="absolute inset-0 animate-bounce-soft text-6xl leading-none">🎁</span>
        <span className="absolute -right-3 -top-3 animate-heartbeat text-2xl">💗</span>
      </div>
      <p className="font-heading text-primary/80">{label ?? 'กำลังห่อของขวัญ…'}</p>
    </div>
  );
}
