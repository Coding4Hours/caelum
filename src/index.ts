import { resolve } from "node:path";
import {
  readFileSync,
  cpSync,
  writeFileSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  rmSync,
  readdirSync,
} from "node:fs";
import { createServer, Server } from "node:http";
import { Socket } from "node:net";
import express, { Request, Response, application } from "express";
//@ts-ignore
import { server as wisp, logging } from "@mercuryworkshop/wisp-js/server";
//@ts-ignore
import { baremuxPath } from "@mercuryworkshop/bare-mux/node";
import { libcurlPath } from "@mercuryworkshop/libcurl-transport";
import { epoxyPath } from "@mercuryworkshop/epoxy-transport";
import { scramjetPath } from "@mercuryworkshop/scramjet/path";
import { ViteDevServer } from "vite";

logging.set_level(logging.ERROR);

interface WispOptions {
  hostname_blacklist?: Array<RegExp>;
  hostname_whitelist?: Array<RegExp>;
  port_blacklist?: (number | Array<number>)[];
  port_whitelist?: (number | Array<number>)[];
  allow_direct_ip?: boolean;
  allow_private_ips?: boolean;
  allow_loopback_ips?: boolean;
  stream_limit_per_host?: number;
  stream_limit_total?: number;
  allow_udp_streams?: boolean;
  allow_tcp_streams?: boolean;
  dns_ttl?: number;
  dns_method?: "lookup" | "resolve";
  dns_servers?: Array<string>;
  dns_result_order?: "ipv4first" | "ipv6first" | "verbatim";
  parse_real_ip?: boolean;
  parse_real_ip_from?: Array<string>;
}

interface Options {
  gv?: boolean;
  scramjet?: boolean;
  demoMode?: boolean;
  default?: string;
  wispOptions?: WispOptions;
}

interface BuildOptions extends Options {
  path?: string;
}

interface ChemicalServer {
  options: Options;
  server: Server;
  app: application;
}

interface ChemicalBuild {
  options: BuildOptions;
}

class ChemicalServer {
  constructor(options: Options = {}) {
    if (options) {
      if (typeof options !== "object" || Array.isArray(options)) {
        options = {};
        console.error("Error: ChemicalServer options invalid.");
      }
    } else {
      options = {};
    }

    if (options.scramjet === undefined) {
      options.scramjet = true;
    }

    if (options.demoMode === undefined) {
      options.demoMode = false;
    }

    this.options = options;
    this.server = createServer();
    this.app = express();
    this.app.serveChemical = this.serveChemical;
  }
  [Symbol.iterator](): Iterator<application | Function> {
    return [this.app, this.listen][Symbol.iterator]();
  }
  serveChemical = () => {
    this.app.get("/chemical.js", async (req: Request, res: Response) => {
      let chemicalMain = await readFileSync(
        resolve(__dirname, "../client/chemical.js"),
        "utf8",
      );

      if (this.options.default) {
        if (this.options.default === "scramjet") {
          chemicalMain =
            `const defaultService = "${this.options.default}";\n\n` +
            chemicalMain;
        } else {
          chemicalMain = `const defaultService = "scramjet";\n\n` + chemicalMain;
          console.error("Error: Chemical default option invalid.");
        }
      } else {
        chemicalMain = `const defaultService = "scramjet";\n\n` + chemicalMain;
      }

      chemicalMain =
        "const scramjetEnabled = " +
        String(this.options.scramjet) +
        ";\n" +
        chemicalMain;
      chemicalMain =
        "const demoMode = " +
        String(this.options.demoMode) +
        ";\n" +
        chemicalMain;

      chemicalMain = "(async () => {\n" + chemicalMain + "\n})();";

      res.type("application/javascript");
      return res.send(chemicalMain);
    });
    this.app.get("/chemical.sw.js", async (req: Request, res: Response) => {
      let chemicalSW = await readFileSync(
        resolve(__dirname, "../client/chemical.sw.js"),
        "utf8",
      );

      chemicalSW =
        "const scramjetEnabled = " +
        String(this.options.scramjet) +
        ";\n" +
        chemicalSW;

      res.type("application/javascript");
      return res.send(chemicalSW);
    });
    this.app.use(express.static(resolve(__dirname, "../client")));
    this.app.use("/baremux/", express.static(baremuxPath));
    this.app.use("/libcurl/", express.static(libcurlPath));
    this.app.use("/epoxy/", express.static(epoxyPath));
    if (this.options.scramjet) {
      this.app.use("/scramjet/", express.static(scramjetPath));
    }
    this.server.on("request", (req: Request, res: Response) => {
      this.app(req, res);
    });
    this.server.on("upgrade", (req: Request, socket: Socket, head: Buffer) => {
      if (req.url && req.url.endsWith("/wisp/")) {
        if (this.options.wispOptions) {
          for (let option in this.options.wispOptions) {
            //@ts-ignore
            wisp.options[option] = this.options.wispOptions[option];
          }
        }
        wisp.routeRequest(req, socket, head);
      } else {
        socket.end();
      }
    });
  };
  listen = (port: number, callback: () => void) => {
    this.server.listen(port, callback);
  };
}

const ChemicalVitePlugin = (options: Options) => ({
  name: "chemical-vite-plugin",
  configureServer(server: ViteDevServer) {
    if (options) {
      if (typeof options !== "object" || Array.isArray(options)) {
        options = {};
        console.error("Error: ChemicalServer options invalid.");
      }
    } else {
      options = {};
    }

    if (options.scramjet === undefined) {
      options.scramjet = true;
    }

    if (options.demoMode === undefined) {
      options.demoMode = false;
    }

    const app: application = express();
    app.get("/chemical.js", async function (req: Request, res: Response) {
      let chemicalMain: string = await readFileSync(
        resolve(__dirname, "../client/chemical.js"),
        "utf8",
      );

      if (options.default) {
        if (options.default === "scramjet") {
          chemicalMain =
            `const defaultService = "${options.default}";\n\n` + chemicalMain;
        } else {
          chemicalMain = `const defaultService = "scramjet";\n\n` + chemicalMain;
          console.error("Error: Chemical default option invalid.");
        }
      } else {
        chemicalMain = `const defaultService = "scramjet";\n\n` + chemicalMain;
      }

      chemicalMain =
        "const scramjetEnabled = " +
        String(options.scramjet) +
        ";\n" +
        chemicalMain;
      chemicalMain =
        "const demoMode = " + String(options.demoMode) + ";\n" + chemicalMain;

      chemicalMain = "(async () => {\n" + chemicalMain + "\n})();";

      res.type("application/javascript");
      return res.send(chemicalMain);
    });
    app.get("/chemical.sw.js", async function (req: Request, res: Response) {
      let chemicalSW: string = await readFileSync(
        resolve(__dirname, "../client/chemical.sw.js"),
        "utf8",
      );

      chemicalSW =
        "const scramjetEnabled = " +
        String(options.scramjet) +
        ";\n" +
        chemicalSW;

      res.type("application/javascript");
      return res.send(chemicalSW);
    });
    app.use(express.static(resolve(__dirname, "../client")));
    app.use("/baremux/", express.static(baremuxPath));
    app.use("/libcurl/", express.static(libcurlPath));
    app.use("/epoxy/", express.static(epoxyPath));
    if (options.scramjet) {
      app.use("/scramjet/", express.static(scramjetPath));
    }
    server.middlewares.use(app);

    const upgraders = server.httpServer?.listeners("upgrade") as ((
      ...args: any[]
    ) => void)[];

    for (const upgrader of upgraders) {
      server?.httpServer?.off("upgrade", upgrader);
    }

    server?.httpServer?.on(
      "upgrade",
      (req: Request, socket: Socket, head: Buffer) => {
        if (req.url && req.url.endsWith("/wisp/")) {
          if (options.wispOptions) {
            for (let option in options.wispOptions) {
              //@ts-ignore
              wisp.options[option] = options.wispOptions[option];
            }
          }
          wisp.routeRequest(req, socket, head);
        } else {
          for (const upgrader of upgraders) {
            upgrader(req, socket, head);
          }
        }
      },
    );
  },
});

class ChemicalBuild {
  constructor(options: BuildOptions) {
    if (options) {
      if (typeof options !== "object" || Array.isArray(options)) {
        options = {};
        console.error("Error: ChemicalBuild options invalid.");
      }
    } else {
      options = {};
    }

    if (options.path === undefined) {
      options.path = "dist";
    }

    if (options.path.startsWith("/")) {
      options.path = options.path.substring(1);
    }

    if (options.path.endsWith("/")) {
      options.path = options.path.slice(0, -1);
    }

    if (options.scramjet === undefined) {
      options.scramjet = true;
    }

    if (options.demoMode === undefined) {
      options.demoMode = false;
    }

    this.options = options;
  }
  async write(deletePath: boolean = false) {
    if (!existsSync(resolve(this.options.path || ""))) {
      mkdirSync(resolve(this.options.path || ""), { recursive: true });
    } else {
      if (deletePath) {
        readdirSync(resolve(this.options.path || "")).forEach((file) =>
          rmSync(resolve(this.options.path || "", file), { recursive: true }),
        );
      }
    }

    let chemicalMain: string = await readFileSync(
      resolve(__dirname, "../client/chemical.js"),
      "utf8",
    );

    if (this.options.default) {
      if (this.options.default === "scramjet") {
        chemicalMain =
          `const defaultService = "${this.options.default}";\n\n` +
          chemicalMain;
      } else {
        chemicalMain = `const defaultService = "scramjet";\n\n` + chemicalMain;
        console.error("Error: Chemical default option invalid.");
      }
    } else {
      chemicalMain = `const defaultService = "scramjet";\n\n` + chemicalMain;
    }

    chemicalMain =
      "const scramjetEnabled = " +
      String(this.options.scramjet) +
      ";\n" +
      chemicalMain;
    chemicalMain =
      "const demoMode = " +
      String(this.options.demoMode) +
      ";\n" +
      chemicalMain;

    chemicalMain = "(async () => {\n" + chemicalMain + "\n})();";

    writeFileSync(
      resolve(this.options.path || "", "chemical.js"),
      chemicalMain,
    );

    let chemicalSW: string = await readFileSync(
      resolve(__dirname, "../client/chemical.sw.js"),
      "utf8",
    );

    chemicalSW =
      "const scramjetEnabled = " +
      String(this.options.scramjet) +
      ";\n" +
      chemicalSW;

    writeFileSync(
      resolve(this.options.path || "", "chemical.sw.js"),
      chemicalSW,
    );

    if (this.options.demoMode) {
      copyFileSync(
        resolve(__dirname, "client/chemical.demo.html"),
        resolve(this.options.path || "", "chemical.demo.html"),
      );
    }

    cpSync(baremuxPath, resolve(this.options.path || "", "baremux"), {
      recursive: true,
    });
    cpSync(libcurlPath, resolve(this.options.path || "", "libcurl"), {
      recursive: true,
    });
    cpSync(epoxyPath, resolve(this.options.path || "", "epoxy"), {
      recursive: true,
    });
    cpSync(libcurlPath, resolve(this.options.path || "", "libcurl"), {
      recursive: true,
    });
  }
}

export { ChemicalServer, ChemicalBuild, ChemicalVitePlugin };
