if (scramjetEnabled) {
  importScripts("/controller/controller.sw.js");
}

if (navigator.userAgent.includes("Firefox")) {
  Object.defineProperty(globalThis, "crossOriginIsolated", {
    value: true,
    writable: false,
  });
}

self.addEventListener("fetch", (event) => {
  event.respondWith(
    (async () => {
      if (scramjetEnabled && $scramjetController.shouldRoute(event)) {
        return await $scramjetController.route(event);
      }
      return await fetch(event.request);
    })()
  );
});
