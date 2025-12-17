// src/components/formula-editor/EmptyState.tsx
// Empty state component for criteria reference panel

/**
 * Empty state shown when no editor context is detected
 * 
 * Displays helpful instructions on how to trigger the reference panel
 * by typing criterion names followed by trigger characters.
 */
export function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center p-6 py-16 text-center max-w-md mx-auto">
      <div className="text-4xl mb-4">📝</div>
      <h3 className="text-lg font-semibold mb-2">Formula Reference</h3>
      <p className="text-sm text-muted-foreground mb-4 break-words">
        Start typing a criterion name followed by space, comma, or parenthesis
        to see available options and descriptions.
      </p>
      <div className="mt-4 text-xs text-muted-foreground space-y-2">
        <p className="font-medium">Try typing:</p>
        <div className="space-y-1.5">
          <div className="flex items-start gap-2">
            <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs shrink-0">sector </code>
            <span className="text-left">View all sectors</span>
          </div>
          <div className="flex items-start gap-2">
            <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs shrink-0">industry(</code>
            <span className="text-left">View industries</span>
          </div>
          <div className="flex items-start gap-2">
            <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs shrink-0">rsi,</code>
            <span className="text-left">View RSI params</span>
          </div>
          <div className="flex items-start gap-2">
            <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs shrink-0">macd </code>
            <span className="text-left">View MACD params</span>
          </div>
        </div>
      </div>
    </div>
  );
}
