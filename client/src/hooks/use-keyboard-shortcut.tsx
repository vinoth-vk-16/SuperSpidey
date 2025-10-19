import { useEffect } from 'react';

export function useKeyboardShortcut(
  keys: string[],
  callback: () => void,
  deps: any[] = []
) {
  useEffect(() => {
    const handleKeydown = (event: KeyboardEvent) => {
      const isMatch = keys.every(key => {
        switch (key) {
          case 'ctrl':
            return event.ctrlKey;
          case 'meta':
            return event.metaKey;
          case 'shift':
            return event.shiftKey;
          case 'alt':
            return event.altKey;
          default:
            return event.key.toLowerCase() === key.toLowerCase();
        }
      });

      if (isMatch) {
        event.preventDefault();
        callback();
      }
    };

    document.addEventListener('keydown', handleKeydown);
    return () => document.removeEventListener('keydown', handleKeydown);
  }, deps);
}
