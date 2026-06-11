class CaelumInput extends HTMLInputElement {
  constructor() {
    super();
  }
  connectedCallback() {
    this.addEventListener("keydown", async function (e) {
      if (e.key === "Enter" && window.caelum.loaded && e.target.value) {
        let service =
          this.dataset.serviceStore !== undefined
            ? localStorage.getItem("@caelum/service") ||
              this.dataset.service ||
              "scramjet"
            : this.dataset.service || "scramjet";
        let autoHttps =
          this.dataset.autoHttpsStore !== undefined
            ? localStorage.getItem("@caelum/autoHttps") === "true"
            : this.dataset.autoHttps !== undefined
              ? true
              : false;
        let searchEngine =
          this.dataset.searchEngineStore !== undefined
            ? localStorage.getItem("@caelum/searchEngine") ||
              this.dataset.searchEngine
            : this.dataset.searchEngine;
        let action = this.dataset.action;
        let target = this.dataset.target;
        let frame = this.dataset.frame;
        let encodedURL = await caelum.encode(e.target.value, {
          service,
          autoHttps,
          searchEngine,
        });

        if (frame) {
          let forFrame = document.getElementById(frame);
          forFrame.src = encodedURL;
          forFrame.setAttribute("data-open", "true");
        }

        if (action) {
          window[action](encodedURL);
        }

        if (target) {
          if (target === "_self") {
            window.location = encodedURL;
          } else if (target === "_blank") {
            window.open(encodedURL);
          }
        }
      }
    });
  }
}

class CaelumButton extends HTMLButtonElement {
  constructor() {
    super();
  }
  connectedCallback() {
    this.addEventListener("click", function (e) {
      let forInput = document.getElementById(this.dataset.for);

      if (forInput) {
        forInput.dispatchEvent(
          new KeyboardEvent("keydown", {
            key: "Enter",
          }),
        );
      }
    });
  }
}

class CaelumIFrame extends HTMLIFrameElement {
  static observedAttributes = ["data-open"];
  constructor() {
    super();
  }
  connectedCallback() {
    let open = this.dataset.open;
    this.style.display = open === "true" ? "" : "none";
  }
  attributeChangedCallback(name, oldValue, newValue) {
    if (name === "data-open") {
      let open = this.dataset.open;
      this.style.display = open === "true" ? "" : "none";

      let controls = document.getElementById(this.dataset.controls);

      if (controls) {
        controls.dataset.open = open;
      }
    }
  }
}

class CaelumControls extends HTMLElement {
  static observedAttributes = ["data-open"];
  constructor() {
    super();
  }
  connectedCallback() {
    let open = this.dataset.open;
    this.style.display = open === "true" ? "" : "none";
  }
  attributeChangedCallback(name, oldValue, newValue) {
    if (name === "data-open") {
      let open = this.dataset.open;
      this.style.display = open === "true" ? "" : "none";
    }
  }
}

class CaelumLink extends HTMLAnchorElement {
  constructor() {
    super();
  }
  async connectedCallback() {
    let href = this.dataset.href;
    let service = this.dataset.service || "scramjet";
    let autoHttps = this.dataset.autoHttps !== undefined ? true : false;
    let searchEngine = this.dataset.searchEngine;
    this.dataset.caelumLoading = "true";

    if (window.caelum.loaded) {
      this.setAttribute(
        "href",
        await caelum.encode(href, {
          service,
          autoHttps,
          searchEngine,
        }),
      );
      this.dataset.caelumLoading = "false";
    } else {
      window.addEventListener("caelumLoaded", async () => {
        this.setAttribute(
          "href",
          await caelum.encode(href, {
            service,
            autoHttps,
            searchEngine,
          }),
        );
        this.dataset.caelumLoading = "false";
      });
    }
  }
}

class CaelumSelect extends HTMLSelectElement {
  constructor() {
    super();
  }
  connectedCallback() {
    const store = this.dataset.defaultStore;

    this.addEventListener("change", function () {
      window.caelum.setStore(store, this.value);
    });

    if (store) {
      const value = window.caelum.getStore(store);

      const observerOptions = {
        childList: true,
        subtree: false,
      };

      const observer = new MutationObserver((records, observer) => {
        for (const record of records) {
          for (const addedNode of record.addedNodes) {
            if (addedNode.tagName === "OPTION") {
              if (addedNode.getAttribute("value") === value) {
                addedNode.setAttribute("selected", "");
              }
            }
          }
        }
      });
      observer.observe(this, observerOptions);
    }
  }
}

customElements.define("caelum-input", CaelumInput, { extends: "input" });
customElements.define("caelum-button", CaelumButton, { extends: "button" });
customElements.define("caelum-iframe", CaelumIFrame, { extends: "iframe" });
customElements.define("caelum-controls", CaelumControls, {
  extends: "section",
});
customElements.define("caelum-link", CaelumLink, { extends: "a" });
customElements.define("caelum-select", CaelumSelect, { extends: "select" });

window.caelum.componentAction = function (action, frameID) {
  let frame = document.getElementById(frameID);

  if (frame) {
    switch (action) {
      case "back":
        frame.contentWindow.history.back();
        break;
      case "forward":
        frame.contentWindow.history.forward();
        break;
      case "reload":
        frame.contentWindow.location.reload();
        break;
      case "close":
        frame.dataset.open = "false";
        frame.src = "";
    }
  }
};
