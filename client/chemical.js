const currentScript = document.currentScript;

window.chemical = {
  loaded: false,
  demoMode,
  transport:
    currentScript.dataset.transportStore !== undefined
      ? localStorage.getItem("@chemical/transport") ||
        currentScript.dataset.transport ||
        "libcurl"
      : currentScript.dataset.transport || "libcurl",
  wisp:
    currentScript.dataset.wispStore !== undefined
      ? localStorage.getItem("@chemical/wisp") ||
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
    case "uv":
      if (uvEnabled) {
        return (
          window.location.origin +
          __uv$config.prefix +
          __uv$config.encodeUrl(url)
        );
      }
      break;
    case "scramjet":
      if (scramjetEnabled) {
        return window.location.origin + chemical.scramjet.encodeUrl(url);
      }
      break;
  }
}

window.chemical.encode = async function (url, config) {
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
    return "/chemical.demo.html";
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

window.chemical.decode = async function (url, config) {
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    config = {
      service: defaultService,
    };
  }

  switch (config.service) {
    case "uv":
      if (uvEnabled) {
        return __uv$config.decodeUrl(url.split(__uv$config.prefix)[1]);
      }
      break;
    case "scramjet":
      if (scramjetEnabled) {
        return $scramjet.codec.decode(url.split($scramjet.config.prefix)[1]);
      }
      break;
  }
};

window.chemical.setStore = function (key, value) {
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
    localStorage.setItem("@chemical/" + key, String(value));
    if (key === "transport") {
      window.chemical.setTransport(value);
    }
    if (key === "wisp") {
      window.chemical.setWisp(value);
    }
    if (key === "title") {
      const titleElement = document.querySelector("title[is='chemical-title']");

      if (titleElement) {
        titleElement.innerText =
          value || titleElement.getAttribute("data-title");
      }
    }
    if (key === "icon") {
      const iconElement = document.querySelector("link[is='chemical-icon']");

      if (iconElement) {
        iconElement.setAttribute(
          "href",
          value || iconElement.getAttribute("data-icon")
        );
      }
    }
    window.dispatchEvent(
      new CustomEvent("chemicalStoreChange", {
        detail: { key, value },
      })
    );
  }
};

window.chemical.getStore = function (key) {
  const value =
    key === "autoHttps"
      ? localStorage.getItem("@chemical/" + key) === "true"
      : localStorage.getItem("@chemical/" + key);

  const defaults = {
    transport: window.chemical.transport,
    wisp: window.chemical.wisp,
    service: "uv",
    autoHttps: false,
    title: document.querySelector("title[is='chemical-title']")?.innerText,
    icon: document
      .querySelector("link[is='chemical-icon']")
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

window.chemical.setTransport = async function (newTransport) {
  newTransport = newTransport || currentScript.dataset.transport || "libcurl";
  await window.chemical.connection.setTransport(getTransport(newTransport), [
    { wisp: window.chemical.wisp },
  ]);
  window.chemical.transport = newTransport;
};

window.chemical.setWisp = async function (wisp) {
  wisp =
    wisp ||
    currentScript.dataset.wisp ||
    (location.protocol === "https:" ? "wss" : "ws") +
      "://" +
      location.host +
      "/wisp/";
  await window.chemical.connection.setTransport(
    getTransport(window.chemical.transport),
    [{ wisp: wisp }]
  );
  window.chemical.wisp = wisp;
};

async function registerSW() {
  if ("serviceWorker" in navigator) {
    await navigator.serviceWorker.register("/chemical.sw.js");
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
  window.chemical.fetch = client.fetch.bind(client);

  window.chemical.getSuggestions = async function (query) {
    if (!query) {
      return [];
    }

    try {
      const DDGSuggestions = await window.chemical.fetch(
        "https://duckduckgo.com/ac/?q=" + query + "&type=list"
      );
      const suggestions = await DDGSuggestions.json();
      return suggestions[1].slice(0, 9);
    } catch {
      return [];
    }
  };

  window.chemical.createDataURL = async function (url) {
    return new Promise(async (resolve, reject) => {
      try {
        const response = await window.chemical.fetch(url);
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
if (uvEnabled) {
  await loadScript(`/${uvRandomPath}/${uvRandomPath}.bundle.js`);
  await loadScript(`/${uvRandomPath}/${uvRandomPath}.config.js`);
}
if (scramjetEnabled) {
  await loadScript("/scramjet/scramjet.all.js");
  const { ScramjetController } = $scramjetLoadController();
  
  chemical.scramjet = new ScramjetController({
    files: {
      wasm: "/scramjet/scramjet.wasm.wasm",
      all: "/scramjet/scramjet.all.js",
      sync: "/scramjet/scramjet.sync.js",
    }
  })
  chemical.scramjet.init();
}
window.chemical.connection = new window.BareMux.BareMuxConnection(
  "/baremux/worker.js"
);
await window.chemical.setTransport(window.chemical.transport);
setupFetch();
await registerSW();
window.chemical.loaded = true;
window.dispatchEvent(new Event("chemicalLoaded"));
