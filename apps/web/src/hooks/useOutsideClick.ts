import { useEffect, useRef } from 'react';

/**
 * Custom hook to handle clicks outside of a referenced element
 * @param callback - Function to call when clicking outside
 * @param isActive - Whether the hook should be active (default: true)
 * @returns ref - Ref to attach to the element you want to detect outside clicks for
 */
export function useOutsideClick<T extends HTMLElement = HTMLElement>(
  callback: () => void,
  isActive: boolean = true
) {
  const ref = useRef<T>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        callback();
      }
    }

    if (isActive) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [callback, isActive]);

  return ref;
}
