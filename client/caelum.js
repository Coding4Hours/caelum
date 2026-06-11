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

async function encodeService(url, service) {
  switch (service) {
    case "scramjet":
      if (scramjetEnabled) {
        return window.location.origin + caelum.scramjet.encodeUrl(url);
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
      if (scramjetEnabled) {
        return $scramjet.codec.decode(url.split($scramjet.config.prefix)[1]);
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

function getTransport(transport) {
  switch (transport) {
    default:
    case "libcurl":
      return "/libcurl/index.mjs";
      break;
    case "epoxy":
      return "/epoxy/index.mjs";
      break;
  }
}

window.caelum.setTransport = async function (newTransport) {
  newTransport = newTransport || currentScript.dataset.transport || "libcurl";
  window.caelum.transport = newTransport;
  if (window.caelum.connection) {
    await window.caelum.connection.setTransport(getTransport(newTransport), [
      { wisp: window.caelum.wisp },
    ]);
  }
  if (window.caelum.scramjet) {
    const resolvedWisp = window.caelum.wisp.startsWith("ws") || window.caelum.wisp.startsWith("http")
      ? window.caelum.wisp
      : `${location.protocol === "https:" ? "wss:" : "ws:"}//${location.host}${window.caelum.wisp.startsWith("/") ? "" : "/"}${window.caelum.wisp}`;
    const transport = newTransport === "epoxy"
      ? new window.EpoxyTransport.EpoxyClient({ wisp: resolvedWisp })
      : new window.LibcurlTransport.LibcurlClient({ wisp: resolvedWisp });
    window.caelum.scramjet.setTransport(transport);
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
  if (window.caelum.connection) {
    await window.caelum.connection.setTransport(
      getTransport(window.caelum.transport),
      [{ wisp: wisp }]
    );
  }
  if (window.caelum.scramjet) {
    const transportType = window.caelum.transport === "epoxy"
      ? new window.EpoxyTransport.EpoxyClient({ wisp })
      : new window.LibcurlTransport.LibcurlClient({ wisp });
    window.caelum.scramjet.setTransport(transportType);
  }
};

async function registerSW() {
  if ("serviceWorker" in navigator) {
    await navigator.serviceWorker.register("/caelum.sw.js");
  } else {
    console.error("Service worker failed to register.");
  }
}

async function loadScript(src) {
  await new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.onload = () => {
      resolve();
    };
    script.onerror = () => {
      reject();
    };
    document.head.appendChild(script);
  });
}

function setupFetch() {
  const client = new window.BareMux.BareClient();
  window.caelum.fetch = client.fetch.bind(client);

  window.caelum.getSuggestions = async function (query) {
    if (!query) {
      return [];
    }

    try {
      const DDGSuggestions = await window.caelum.fetch(
        "https://duckduckgo.com/ac/?q=" + query + "&type=list"
      );
      const suggestions = await DDGSuggestions.json();
      return suggestions[1].slice(0, 9);
    } catch {
      return [];
    }
  };

  window.caelum.createDataURL = async function (url) {
    return new Promise(async (resolve, reject) => {
      try {
        const response = await window.caelum.fetch(url);
        const blob = await response.blob();
        const reader = new FileReader();

        reader.onloadend = function () {
          resolve(reader.result);
        };

        reader.readAsDataURL(blob);
      } catch {
        resolve(undefined);
      }
    });
  };
}

await loadScript("/baremux/index.js");

if (scramjetEnabled) {
  await loadScript("/scramjet/scramjet.js");
  await loadScript("/scramjet/controller.api.js");
}

await registerSW();

if (scramjetEnabled) {
  const transportType = caelum.transport === "epoxy" ? "EpoxyClient" : "LibcurlClient";
  const transportModule = transportType === "EpoxyClient" ? window.EpoxyTransport : window.LibcurlTransport;
  const transport = new transportModule[transportType]({ wisp: caelum.wisp });

  const { Controller, config } = window.$scramjetController;
  config.injectPath = "/scramjet/controller.inject.js";
  config.wasmPath = "/scramjet/scramjet.wasm";
  config.scramjetPath = "/scramjet/scramjet.js";

  const sw = await navigator.serviceWorker.ready;
  caelum.scramjet = new Controller({ serviceworker: sw, transport });
  await caelum.scramjet.wait();
  caelum.scramjet.encodeUrl = (url) => {
    const ctx = {
      config: caelum.scramjet.scramjetConfig,
      prefix: new URL(caelum.scramjet.prefix + "x/", location.href),
      interface: {
        codecEncode: caelum.scramjet.config.codec.encode,
        codecDecode: caelum.scramjet.config.codec.decode,
      },
    };
    return $scramjet.rewriteUrl(url, ctx, {
      origin: new URL(location.href),
      base: new URL(location.href),
    });
  };
}

window.caelum.connection = new window.BareMux.BareMuxConnection(
  "/baremux/worker.js"
);
setupFetch();
window.caelum.loaded = true;
window.dispatchEvent(new Event("caelumLoaded"));
