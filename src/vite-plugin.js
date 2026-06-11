import express from "express";
//@ts-ignore
import { server as wisp } from "@mercuryworkshop/wisp-js/server";
//@ts-ignore
import { baremuxPath } from "@mercuryworkshop/bare-mux/node";
import { libcurlPath } from "@mercuryworkshop/libcurl-transport";
import { epoxyPath } from "@mercuryworkshop/epoxy-transport";
import { services } from "./proxys";
const ROOT = new URL("..", import.meta.url).pathname;
const ChemicalVitePlugin = (options) => ({
    name: "chemical-vite-plugin",
    configureServer(server) {
        if (options) {
            if (typeof options !== "object" || Array.isArray(options)) {
                options = {};
                console.error("Error: ChemicalServer options invalid.");
            }
        }
        else {
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
        const app = express();
        app.get("/chemical.js", async function (req, res) {
            let chemicalMain = await Bun.file(ROOT + "client/chemical.js").text();
            if (options.default) {
                const serviceNames = services.map((s) => s.name);
                if (serviceNames.includes(options.default)) {
                    chemicalMain =
                        `const defaultService = "${options.default}";\n\n` + chemicalMain;
                }
                else {
                    chemicalMain =
                        `const defaultService = "${serviceNames[0] || "scramjet"}";\n\n` +
                            chemicalMain;
                    console.error("Error: Chemical default option invalid.");
                }
            }
            else {
                chemicalMain = `const defaultService = "scramjet";\n\n` + chemicalMain;
            }
            for (const service of services) {
                chemicalMain =
                    "const " +
                        service.name +
                        "Enabled = " +
                        String(options[service.name]) +
                        ";\n" +
                        chemicalMain;
            }
            chemicalMain =
                "const demoMode = " + String(options.demoMode) + ";\n" + chemicalMain;
            chemicalMain = "(async () => {\n" + chemicalMain + "\n})();";
            res.type("application/javascript");
            return res.send(chemicalMain);
        });
        app.get("/chemical.sw.js", async function (req, res) {
            let chemicalSW = await Bun.file(ROOT + "client/chemical.sw.js").text();
            for (const service of services) {
                chemicalSW =
                    "const " +
                        service.name +
                        "Enabled = " +
                        String(options[service.name]) +
                        ";\n" +
                        chemicalSW;
            }
            res.type("application/javascript");
            return res.send(chemicalSW);
        });
        app.use(express.static(ROOT + "client"));
        app.use("/baremux/", express.static(baremuxPath));
        app.use("/libcurl/", express.static(libcurlPath));
        app.use("/epoxy/", express.static(epoxyPath));
        for (const service of services) {
            if (options[service.name] && service.nodePath) {
                app.use(service.staticUrl, express.static(service.nodePath));
            }
        }
        server.middlewares.use(app);
        const upgraders = server.httpServer?.listeners("upgrade");
        for (const upgrader of upgraders) {
            server?.httpServer?.off("upgrade", upgrader);
        }
        server?.httpServer?.on("upgrade", (req, socket, head) => {
            if (req.url && req.url.endsWith("/wisp/")) {
                if (options.wispOptions) {
                    for (let option in options.wispOptions) {
                        //@ts-ignore
                        wisp.options[option] = options.wispOptions[option];
                    }
                }
                wisp.routeRequest(req, socket, head);
            }
            else {
                for (const upgrader of upgraders) {
                    upgrader(req, socket, head);
                }
            }
        });
    },
});
export { ChemicalVitePlugin };
