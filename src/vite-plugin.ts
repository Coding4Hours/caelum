import type { Socket } from "net";
import express, {
  type Request,
  type Response,
  type Application,
} from "express";
//@ts-ignore
import { server as wisp } from "@mercuryworkshop/wisp-js/server";
//@ts-ignore
import type { ViteDevServer } from "vite";
import { services } from "./proxys";

const ROOT = new URL("..", import.meta.url).pathname;

const CaelumVitePlugin = (options: Options) => ({
  name: "caelum-vite-plugin",
  configureServer(server: ViteDevServer) {
    if (options) {
      if (typeof options !== "object" || Array.isArray(options)) {
        options = {};
        console.error("Error: CaelumServer options invalid.");
      }
    } else {
      options = {};
    }

    for (const service of services) {
      if (options[service.name] === undefined) {
        options[service.name] = true;
      }
    }

    if (options.demoMode === undefined) {
      options.demoMode = false;
    }

    const app: Application = express();
    app.get("/caelum.js", async function (req: Request, res: Response) {
      let caelumMain: string = await Bun.file(ROOT + "client/caelum.js").text();

      if (options.default) {
        const serviceNames = services.map((s) => s.name);
        if (serviceNames.includes(options.default)) {
          caelumMain =
            `const defaultService = "${options.default}";\n\n` + caelumMain;
        } else {
          caelumMain =
            `const defaultService = "${serviceNames[0] || "scramjet"}";\n\n` +
            caelumMain;
          console.error("Error: Caelum default option invalid.");
        }
      } else {
        caelumMain = `const defaultService = "scramjet";\n\n` + caelumMain;
      }

      for (const service of services) {
        caelumMain =
          "const " +
          service.name +
          "Enabled = " +
          String(options[service.name]) +
          ";\n" +
          caelumMain;
      }

      caelumMain =
        "const demoMode = " + String(options.demoMode) + ";\n" + caelumMain;

      caelumMain = "(async () => {\n" + caelumMain + "\n})();";

      res.type("application/javascript");
      return res.send(caelumMain);
    });
    app.get("/caelum.sw.js", async function (req: Request, res: Response) {
      let caelumSW: string = await Bun.file(
        ROOT + "client/caelum.sw.js",
      ).text();

      for (const service of services) {
        caelumSW =
          "const " +
          service.name +
          "Enabled = " +
          String(options[service.name]) +
          ";\n" +
          caelumSW;
      }

      res.type("application/javascript");
      return res.send(caelumSW);
    });
    app.use(express.static(ROOT + "client"));
    for (const service of services) {
      if (options[service.name] && service.nodePath) {
        const paths = Array.isArray(service.nodePath)
          ? service.nodePath
          : [service.nodePath];
        for (const p of paths) {
          app.use(service.staticUrl, express.static(p));
        }
      }
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

export { CaelumVitePlugin };
