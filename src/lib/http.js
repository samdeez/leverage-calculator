/** fetch JSON with a timeout. Throws on non-2xx. */
export async function getJson(url, { timeout = 12000, headers, method = "GET", body } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(url, {
      method,
      headers: { ...(body ? { "content-type": "application/json" } : {}), ...headers },
      body: body ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
    });
    if (!res.ok) {
      const err = new Error(`HTTP ${res.status} ${url.split("?")[0]}`);
      err.status = res.status;
      throw err;
    }
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Serialises calls so that consecutive starts are at least `gap()` ms apart.
 * Keeps keyless public APIs inside their rate limits.
 */
export function rateLimiter(gap) {
  let last = 0;
  let chain = Promise.resolve();
  return (fn) => {
    const run = chain.then(async () => {
      const wait = Math.max(0, last + gap() - Date.now());
      if (wait) await new Promise((r) => setTimeout(r, wait));
      last = Date.now();
      return fn();
    });
    chain = run.catch(() => {});
    return run;
  };
}

/** Retry a request on HTTP 429 / network errors with exponential backoff. */
export async function withRetry(fn, { tries = 3, base = 2500 } = {}) {
  for (let i = 0; ; i++) {
    try {
      return await fn();
    } catch (err) {
      const retryable = err.status === 429 || err.status >= 500 || err.name === "AbortError" || err instanceof TypeError;
      if (!retryable || i >= tries - 1) throw err;
      await new Promise((r) => setTimeout(r, base * 2 ** i));
    }
  }
}

export const chunk = (arr, n) => {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
};
