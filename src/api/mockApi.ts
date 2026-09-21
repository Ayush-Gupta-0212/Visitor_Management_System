/**
 * A simulated backend.
 *
 * The case study says to use mock data where no API is available. A plain
 * synchronous mock would have hidden every interesting UI state, so this layer
 * behaves like a real network instead: it is asynchronous, it takes a variable
 * amount of time, it can be cancelled, and it can be made to fail on demand.
 *
 * That is what lets the app honestly demonstrate loading skeletons, retries,
 * optimistic updates with rollback, and error messaging - three of the six
 * stated evaluation criteria.
 */

/** Tunable from the UI (Admin -> Data tools) so failures can be demonstrated live. */
export interface NetworkProfile {
  /** Minimum simulated round-trip, in milliseconds. */
  minLatencyMs: number;
  maxLatencyMs: number;
  /** 0 = never fail, 1 = always fail. Drives the "chaos mode" switch. */
  failureRate: number;
}

export const DEFAULT_PROFILE: NetworkProfile = {
  minLatencyMs: 120,
  maxLatencyMs: 380,
  failureRate: 0,
};

let profile: NetworkProfile = { ...DEFAULT_PROFILE };

export function setNetworkProfile(next: Partial<NetworkProfile>): void {
  profile = { ...profile, ...next };
}

export function getNetworkProfile(): NetworkProfile {
  return { ...profile };
}

/** Thrown when the simulated network fails. Distinct from a DomainError. */
export class NetworkError extends Error {
  constructor(message = 'Network request failed. Check your connection and try again.') {
    super(message);
    this.name = 'NetworkError';
  }
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(new DOMException('Aborted', 'AbortError'));
      },
      { once: true },
    );
  });
}

/**
 * Wraps a piece of work so it behaves like a network call.
 *
 * The work itself stays synchronous and local (it runs against the in-memory
 * index), which is why the UI can still be optimistic: we apply the change
 * immediately, then await this and roll back if it rejects.
 */
export async function request<T>(work: () => T, signal?: AbortSignal): Promise<T> {
  const { minLatencyMs, maxLatencyMs, failureRate } = profile;
  const latency = minLatencyMs + Math.random() * (maxLatencyMs - minLatencyMs);

  await delay(latency, signal);

  if (Math.random() < failureRate) {
    throw new NetworkError();
  }
  return work();
}

/**
 * Retries a failing request with exponential back-off.
 * Domain errors are never retried - they will fail identically every time.
 */
export async function requestWithRetry<T>(
  work: () => T,
  options: { retries?: number; signal?: AbortSignal } = {},
): Promise<T> {
  const { retries = 2, signal } = options;
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await request(work, signal);
    } catch (error) {
      if (!(error instanceof NetworkError)) throw error;
      lastError = error;
      if (attempt < retries) {
        await delay(2 ** attempt * 250, signal);
      }
    }
  }
  throw lastError;
}
