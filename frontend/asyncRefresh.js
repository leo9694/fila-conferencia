(function (global) {
  function wait(ms) {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }

  function createAsyncRefreshLoop(task, options = {}) {
    const intervalMs = options.intervalMs ?? 15000;
    const onError = options.onError ?? (() => {});

    let stopped = true;
    let runningPromise = null;

    async function runLoop() {
      while (!stopped) {
        try {
          await task();
        } catch (error) {
          onError(error);
        }

        if (stopped) {
          break;
        }

        await wait(intervalMs);
      }
    }

    return {
      start() {
        if (!stopped) {
          return runningPromise;
        }

        stopped = false;
        runningPromise = runLoop().finally(() => {
          runningPromise = null;
        });
        return runningPromise;
      },

      stop() {
        stopped = true;
        return runningPromise;
      },

      isRunning() {
        return !stopped;
      }
    };
  }

  global.createAsyncRefreshLoop = createAsyncRefreshLoop;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { createAsyncRefreshLoop };
  }
})(typeof window !== 'undefined' ? window : globalThis);
