const PKG = {
  scramjet: "/scramjet",
  controller: "/controller",
  epoxy: "/epoxy",
  libcurl: "/libcurl",
};

const currentScript = document.currentScript;

window.caelum = {
  loaded: false,
  demoMode,
  transport:
    currentScript.dataset.transportStore !== undefined
      ? localStorage.getItem("@caelum/transport") ||
        currentScript.dataset.transport ||
        "libcurl"
      : currentScript.dataset.transport || "libcurl",
  wisp:
    currentScript.dataset.wispStore !== undefined
      ? localStorage.getItem("@caelum/wisp") ||
        currentScript.dataset.wisp ||
        (location.protocol === "https:" ? "wss" : "ws") +
          "://" +
          location.host +
          "/wisp/"
      : currentScript.dataset.wisp ||
        (location.protocol === "https:" ? "wss" : "ws") +
          "://" +
          location.host +
          "/wisp/",
};

function loadScript(url) {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = url;
    script.onload = () => resolve();
    script.onerror = () => reject(Error("Failed to load: " + url));
    document.head.appendChild(script);
  });
}

async function registerSW() {
  if (!("serviceWorker" in navigator)) {
    throw Error("Service worker not supported");
  }
  const r = await navigator.serviceWorker.register("/caelum.sw.js", {
    type: "classic",
    updateViaCache: "none",
  });
  await navigator.serviceWorker.ready;
  if (r.active) return r.active;
  if (r.installing) {
    await new Promise((resolve) => {
      const sw = r.installing;
      if (sw.state === "activated") resolve();
      else
        sw.addEventListener("statechange", function onChange() {
          if (sw.state === "activated") {
            sw.removeEventListener("statechange", onChange);
            resolve();
          }
        });
    });
    return r.active;
  }
  if (r.waiting) {
    await new Promise((resolve) =>
      navigator.serviceWorker.addEventListener("controllerchange", resolve, {
        once: true,
      })
    );
    return navigator.serviceWorker.controller;
  }
  throw Error("No service worker found");
}

let controller;

async function ensureInit() {
  if (controller) return;
  const sw = await registerSW();
  if (scramjetEnabled) {
    await loadScript(PKG.scramjet + "/scramjet.js");
    await loadScript(PKG.controller + "/controller.api.js");
    const transportScript =
      window.caelum.transport === "epoxy"
        ? PKG.epoxy + "/index.js"
        : PKG.libcurl + "/index.js";
    await loadScript(transportScript);
    const resolvedWisp =
      window.caelum.wisp.startsWith("ws") ||
      window.caelum.wisp.startsWith("http")
        ? window.caelum.wisp
        : `${location.protocol === "https:" ? "wss:" : "ws:"}//${location.host}${window.caelum.wisp.startsWith("/") ? "" : "/"}${window.caelum.wisp}`;
    const transport =
      window.caelum.transport === "epoxy"
        ? new window.EpoxyTransport.EpoxyClient({ wisp: resolvedWisp })
        : new window.LibcurlTransport.LibcurlClient({ wisp: resolvedWisp });
    const { Controller, config } = window.$scramjetController;
    config.injectPath = PKG.controller + "/controller.inject.js";
    config.wasmPath = PKG.scramjet + "/scramjet.wasm";
    config.scramjetPath = PKG.scramjet + "/scramjet.js";
    controller = new Controller({ serviceworker: sw, transport });
    await controller.wait();
    window.caelum.scramjet = controller;
    window.caelum.scramjet.encodeUrl = (url) => {
      const ctx = {
        config: controller.scramjetConfig,
        prefix: new URL(controller.prefix + "x/", location.href),
        interface: {
          codecEncode: controller.config.codec.encode,
          codecDecode: controller.config.codec.decode,
        },
      };
      return $scramjet.rewriteUrl(url, ctx, {
        origin: new URL(location.href),
        base: new URL(location.href),
      });
    };
  }
}

async function encodeService(url, service) {
  switch (service) {
    case "scramjet":
      if (scramjetEnabled && window.caelum.scramjet) {
        return window.location.origin + window.caelum.scramjet.encodeUrl(url);
      }
      break;
  }
}

window.caelum.encode = async function (url, config) {
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    config = {
      service: defaultService,
      autoHttps: false,
    };
  }

  if (config.service === undefined) {
    config.service = defaultService;
  }

  if (config.autoHttps === undefined) {
    config.autoHttps = false;
  }

  if (demoMode) {
    return "/caelum.demo.html";
  }

  if (url.match(/^https?:\/\//)) {
    return await encodeService(url, config.service);
  } else if (
    config.autoHttps === true &&
    url.includes(".") &&
    !url.includes(" ")
  ) {
    return await encodeService("https://" + url, config.service);
  } else if (config.searchEngine) {
    return await encodeService(
      config.searchEngine.replace("%s", encodeURIComponent(url)),
      config.service
    );
  } else {
    return await encodeService(url, config.service);
  }
};

window.caelum.decode = async function (url, config) {
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    config = {
      service: defaultService,
    };
  }

  switch (config.service) {
    case "scramjet":
      if (scramjetEnabled && controller) {
        return controller.config.codec.decode(
          url.split(controller.prefix)[1]
        );
      }
      break;
  }
};

window.caelum.setStore = function (key, value) {
  const allowed = [
    "transport",
    "wisp",
    "service",
    "autoHttps",
    "searchEngine",
    "title",
    "icon",
  ];

  if (allowed.includes(key)) {
    localStorage.setItem("@caelum/" + key, String(value));
    if (key === "transport") {
      window.caelum.setTransport(value);
    }
    if (key === "wisp") {
      window.caelum.setWisp(value);
    }
    if (key === "title") {
      const titleElement = document.querySelector("title[is='caelum-title']");

      if (titleElement) {
        titleElement.innerText =
          value || titleElement.getAttribute("data-title");
      }
    }
    if (key === "icon") {
      const iconElement = document.querySelector("link[is='caelum-icon']");

      if (iconElement) {
        iconElement.setAttribute(
          "href",
          value || iconElement.getAttribute("data-icon")
        );
      }
    }
    window.dispatchEvent(
      new CustomEvent("caelumStoreChange", {
        detail: { key, value },
      })
    );
  }
};

window.caelum.getStore = function (key) {
  const value =
    key === "autoHttps"
      ? localStorage.getItem("@caelum/" + key) === "true"
      : localStorage.getItem("@caelum/" + key);

  const defaults = {
    transport: window.caelum.transport,
    wisp: window.caelum.wisp,
    service: "scramjet",
    autoHttps: false,
    title: document.querySelector("title[is='caelum-title']")?.innerText,
    icon: document
      .querySelector("link[is='caelum-icon']")
      ?.getAttribute("href"),
  };

  return value || defaults[key];
};

window.caelum.setTransport = async function (newTransport) {
  newTransport = newTransport || currentScript.dataset.transport || "libcurl";
  window.caelum.transport = newTransport;
  if (controller) {
    const resolvedWisp =
      window.caelum.wisp.startsWith("ws") ||
      window.caelum.wisp.startsWith("http")
        ? window.caelum.wisp
        : `${location.protocol === "https:" ? "wss:" : "ws:"}//${location.host}${window.caelum.wisp.startsWith("/") ? "" : "/"}${window.caelum.wisp}`;
    const transportScript =
      newTransport === "epoxy"
        ? PKG.epoxy + "/index.js"
        : PKG.libcurl + "/index.js";
    await loadScript(transportScript);
    const t =
      newTransport === "epoxy"
        ? new window.EpoxyTransport.EpoxyClient({ wisp: resolvedWisp })
        : new window.LibcurlTransport.LibcurlClient({ wisp: resolvedWisp });
    controller.setTransport(t);
  }
};

window.caelum.setWisp = async function (wisp) {
  wisp =
    wisp ||
    currentScript.dataset.wisp ||
    (location.protocol === "https:" ? "wss" : "ws") +
      "://" +
      location.host +
      "/wisp/";
  window.caelum.wisp = wisp;
  if (controller) {
    const transportType =
      window.caelum.transport === "epoxy"
        ? new window.EpoxyTransport.EpoxyClient({ wisp })
        : new window.LibcurlTransport.LibcurlClient({ wisp });
    controller.setTransport(transportType);
  }
};

window.caelum.getSuggestions = async function (query) {
  if (!query) {
    return [];
  }

  try {
    const response = await fetch(
      "https://duckduckgo.com/ac/?q=" +
        encodeURIComponent(query) +
        "&type=list"
    );
    const suggestions = await response.json();
    return suggestions[1].slice(0, 9);
  } catch {
    return [];
  }
};

window.caelum.createDataURL = async function (url) {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.readAsDataURL(blob);
    });
  } catch {
    return undefined;
  }
};

await ensureInit();
window.caelum.loaded = true;
window.dispatchEvent(new Event("caelumLoaded"));
