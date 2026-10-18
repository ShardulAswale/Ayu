/** Reuse a pending request and clear it after either success or failure. */
export function singleFlight(callback) {
  let pending = null;
  const run = () => {
    if (!pending) {
      const operation = Promise.resolve().then(callback);
      const current = operation.finally(() => {
        // A reset must not allow an older completion to clear a new request.
        if (pending === current) pending = null;
      });
      pending = current;
    }
    return pending;
  };
  run.reset = () => { pending = null; };
  return run;
}
