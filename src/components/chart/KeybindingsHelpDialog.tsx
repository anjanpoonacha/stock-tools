'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import keybindingsData from '@/config/keybindings.json';

interface KeybindingsHelpDialogProps {
  open: boolean;
  onClose: () => void;
}

interface KeyBinding {
  key: string;
  description: string;
}

interface KeybindingSection {
  title: string;
  bindings: KeyBinding[];
}

// Platform detection utility
const isMac = typeof window !== 'undefined' && navigator.userAgent.toUpperCase().indexOf('MAC') >= 0;

// Format key for display (convert modifiers for macOS)
function formatKey(key: string): string {
  if (!isMac) return key;
  
  // Convert modifiers for macOS display
  return key
    .replace(/Alt\+/g, '⌥')
    .replace(/Ctrl\+/g, '⌃')
    .replace(/Shift\+/g, '⇧')
    .replace(/Meta\+/g, '⌘');
}

// Parse keybindings.json and built-in shortcuts
function getKeybindingSections(): KeybindingSection[] {
  const sections: KeybindingSection[] = [];

  // Navigation section
  sections.push({
    title: 'Navigation',
    bindings: [
      { key: 'ArrowUp', description: 'Navigate to previous stock' },
      { key: 'ArrowDown', description: 'Navigate to next stock' },
      { key: 'Tab', description: 'Cycle through charts in dual view' },
    ],
  });

  // Watchlist Management section
  const watchlistBindings = keybindingsData.chart.watchlist;
  sections.push({
    title: 'Watchlist Management',
    bindings: [
      { key: watchlistBindings.openSearch, description: 'Open watchlist search dialog' },
      { key: watchlistBindings.quickAdd, description: 'Quick add to current watchlist' },
      { key: watchlistBindings.quickRemove, description: 'Remove current stock from watchlist' },
    ],
  });

  // Input Modes section
  sections.push({
    title: 'Input Modes',
    bindings: [
      { key: '0-9', description: 'Start timeframe input mode' },
      { key: 'A-Z', description: 'Start symbol search mode' },
      { key: 'Enter', description: 'Submit input' },
      { key: 'Backspace', description: 'Delete last character or close overlay' },
      { key: 'Escape', description: 'Close overlays and dialogs' },
    ],
  });

  return sections;
}

// Key badge component
function KeyBadge({ keyText }: { keyText: string }) {
  // Split modifier symbols from the actual key for better spacing
  const parts = keyText.split(/([⌥⌃⇧⌘])/g).filter(Boolean);
  
  return (
    <kbd className="inline-flex items-center justify-center gap-1 px-2.5 py-1.5 text-sm font-mono font-bold bg-background border-2 border-border rounded-md min-w-[3rem]">
      {parts.map((part, i) => (
        <span key={i} className={part.match(/[⌥⌃⇧⌘]/) ? "text-base" : ""}>
          {part}
        </span>
      ))}
    </kbd>
  );
}

export function KeybindingsHelpDialog({ open, onClose }: KeybindingsHelpDialogProps) {
  const sections = getKeybindingSections();

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Chart Keybindings</DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[500px] pr-4">
          <div className="space-y-6">
            {sections.map((section, sectionIndex) => (
              <div key={sectionIndex}>
                <h3 className="text-sm font-semibold mb-3">{section.title}</h3>
                <div className="grid grid-cols-[1fr_auto] gap-x-8 gap-y-3">
                  {section.bindings.map((binding, bindingIndex) => (
                    <>
                      <span key={`desc-${bindingIndex}`} className="text-sm text-foreground">
                        {binding.description}
                      </span>
                      <KeyBadge key={`key-${bindingIndex}`} keyText={formatKey(binding.key)} />
                    </>
                  ))}
                </div>
                {sectionIndex < sections.length - 1 && (
                  <Separator className="mt-4" />
                )}
              </div>
            ))}
          </div>
        </ScrollArea>

        <div className="pt-4 border-t border-border">
          <p className="text-xs text-muted-foreground">
            Tip: Most shortcuts work when no overlay is open. Press Escape to close any active overlay or dialog.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
