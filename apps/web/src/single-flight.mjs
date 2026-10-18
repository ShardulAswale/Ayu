/** Reuse a pending request and clear it after either success or failure. */
export function singleFlight(callback) {
  let pending = null;
  return () => {
    if (!pending) {
      const operation = Promise.resolve().then(callback);
      pending = operation.finally(() => { pending = null; });
    }
    return pending;
  };
}
