import { useEffect, useRef } from 'react';
import * as Linking from 'expo-linking';
import { completeAccountRedirect } from './auth';
import type { AccountRedirectResult } from './auth';

/** Mount once near the root navigator so password links work after a cold start. */
export function useAccountRedirect(
  onResult: (result: AccountRedirectResult) => void,
  onError: (error: Error) => void,
): void {
  const callbacks = useRef({ onResult, onError });
  const lastUrl = useRef<string | null>(null);
  const url = Linking.useLinkingURL();

  useEffect(() => { callbacks.current = { onResult, onError }; }, [onResult, onError]);

  useEffect(() => {
    let mounted = true;
    const handle = async (url: string | null) => {
      if (!url || url === lastUrl.current || !url.includes('auth/callback')) return;
      lastUrl.current = url;
      try {
        const result = await completeAccountRedirect(url);
        if (mounted && result.kind !== 'ignored') callbacks.current.onResult(result);
      } catch (error) {
        if (mounted) callbacks.current.onError(error instanceof Error ? error : new Error(String(error)));
      }
    };
    void handle(url);
    return () => { mounted = false; };
  }, [url]);
}
