/** Longest the Manager waits for the indexer before surfacing an error instead of a spinner. */
export const GRAPHQL_REQUEST_DEADLINE_MS = 10_000;

/**
 * Wraps `fetch` so a request that never answers (hung or 5xx-after-a-long-wait indexer) rejects
 * once the deadline elapses. The caller's init (including its abort signal) is passed through
 * untouched; the late response of a timed-out request is ignored.
 */
export function createDeadlineFetch(
  deadlineMs: number = GRAPHQL_REQUEST_DEADLINE_MS,
  baseFetch: typeof fetch = (...args) => fetch(...args)
): typeof fetch {
  return (input, init) =>
    new Promise<Response>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`The indexer did not respond within ${deadlineMs}ms.`)),
        deadlineMs
      );
      baseFetch(input, init).then(
        (response) => {
          clearTimeout(timer);
          resolve(response);
        },
        (error) => {
          clearTimeout(timer);
          reject(error);
        }
      );
    });
}
