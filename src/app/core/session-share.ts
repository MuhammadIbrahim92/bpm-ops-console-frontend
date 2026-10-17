/**
 * Lets a new browser tab pick up the sign-in of a tab that is already open.
 *
 * The token lives in sessionStorage, which every tab has to itself, so a link opened in a new tab used to ask for the
 * user name and password again. A tab that has no token now asks the other tabs of this app over a BroadcastChannel
 * (same address only: other sites and the sandboxed form frames cannot take part), and a tab that is signed in
 * answers. Nothing is written to disk, and when the last tab closes the sign-in is gone, as before.
 */
const CHANNEL = 'bpm-console-session';

interface Message {
  kind: 'need' | 'token';
  token?: string;
}

function open(): BroadcastChannel | null {
  try {
    return typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(CHANNEL);
  } catch {
    return null;
  }
}

/** Answers other tabs that ask for the sign-in, for as long as this tab is open. Returns a function that stops it. */
export function shareSession(getToken: () => string | null): () => void {
  const channel = open();
  if (!channel) {
    return () => undefined;
  }
  channel.onmessage = (e: MessageEvent<Message>) => {
    const token = getToken();
    if (e.data?.kind === 'need' && token) {
      channel.postMessage({ kind: 'token', token } as Message);
    }
  };
  return () => channel.close();
}

/** Asks the other open tabs for their sign-in; null when none answers within the time given. */
export function borrowSession(timeoutMs = 400): Promise<string | null> {
  const channel = open();
  if (!channel) {
    return Promise.resolve(null);
  }
  return new Promise(resolve => {
    const done = (token: string | null) => {
      clearTimeout(timer);
      channel.close();
      resolve(token);
    };
    const timer = setTimeout(() => done(null), timeoutMs);
    channel.onmessage = (e: MessageEvent<Message>) => {
      if (e.data?.kind === 'token' && typeof e.data.token === 'string' && e.data.token) {
        done(e.data.token);
      }
    };
    channel.postMessage({ kind: 'need' } as Message);
  });
}
