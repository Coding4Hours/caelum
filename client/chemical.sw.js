if (scramjetEnabled) {
  importScripts("/scramjet/scramjet.wasm.js");
  importScripts("/scramjet/scramjet.shared.js");
  importScripts("/scramjet/scramjet.worker.js");
}

if (navigator.userAgent.includes("Firefox")) {
  Object.defineProperty(globalThis, "crossOriginIsolated", {
    value: true,
    writable: false,
  });
}

let scramjet;

if (scramjetEnabled) {
  scramjet = new ScramjetServiceWorker();
}

self.addEventListener("fetch", (event) => {
  event.respondWith(
    (async () => {
      if (scramjetEnabled) {
        await scramjet.loadConfig();
      }

      if (scramjetEnabled && scramjet.route(event)) {
        return await scramjet.fetch(event);
      }
      return await fetch(event.request);
    })()
  );
});
