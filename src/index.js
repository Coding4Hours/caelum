import { createServer } from "node:http";
import express from "express";
//@ts-ignore
import { server as wisp, logging } from "@mercuryworkshop/wisp-js/server";
//@ts-ignore
import { baremuxPath } from "@mercuryworkshop/bare-mux/node";
import { libcurlPath } from "@mercuryworkshop/libcurl-transport";
import { epoxyPath } from "@mercuryworkshop/epoxy-transport";
import { services } from "./proxys";
import { ChemicalVitePlugin } from "./vite-plugin";
const ROOT = new URL("..", import.meta.url).pathname;
logging.set_level(logging.ERROR);
class ChemicalServer {
    constructor(options = {}) {
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
        this.options = options;
        this.server = createServer();
        this.app = express();
        this.app.serveChemical = this.serveChemical;
    }
    [Symbol.iterator]() {
        return [this.app, this.listen][Symbol.iterator]();
    }
    serveChemical = () => {
        this.app.get("/chemical.js", async (req, res) => {
            let chemicalMain = await Bun.file(ROOT + "client/chemical.js").text();
            if (this.options.default) {
                const serviceNames = services.map((s) => s.name);
                if (serviceNames.includes(this.options.default)) {
                    chemicalMain =
                        `const defaultService = "${this.options.default}";\n\n` +
                            chemicalMain;
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
                        String(this.options[service.name]) +
                        ";\n" +
                        chemicalMain;
            }
            chemicalMain =
                "const demoMode = " +
                    String(this.options.demoMode) +
                    ";\n" +
                    chemicalMain;
            chemicalMain = "(async () => {\n" + chemicalMain + "\n})();";
            res.type("application/javascript");
            return res.send(chemicalMain);
        });
        this.app.get("/chemical.sw.js", async (req, res) => {
            let chemicalSW = await Bun.file(ROOT + "client/chemical.sw.js").text();
            for (const service of services) {
                chemicalSW =
                    "const " +
                        service.name +
                        "Enabled = " +
                        String(this.options[service.name]) +
                        ";\n" +
                        chemicalSW;
            }
            res.type("application/javascript");
            return res.send(chemicalSW);
        });
        this.app.use(express.static(ROOT + "client"));
        this.app.use("/baremux/", express.static(baremuxPath));
        this.app.use("/libcurl/", express.static(libcurlPath));
        this.app.use("/epoxy/", express.static(epoxyPath));
        for (const service of services) {
            if (this.options[service.name] && service.nodePath) {
                this.app.use(service.staticUrl, express.static(service.nodePath));
            }
        }
        this.server.on("request", (req, res) => {
            this.app(req, res);
        });
        this.server.on("upgrade", (req, socket, head) => {
            if (req.url && req.url.endsWith("/wisp/")) {
                if (this.options.wispOptions) {
                    for (let option in this.options.wispOptions) {
                        //@ts-ignore
                        wisp.options[option] = this.options.wispOptions[option];
                    }
                }
                wisp.routeRequest(req, socket, head);
            }
            else {
                socket.end();
            }
        });
    };
    listen = (port, callback) => {
        this.server.listen(port, callback);
    };
}
class ChemicalBuild {
    constructor(options) {
        if (options) {
            if (typeof options !== "object" || Array.isArray(options)) {
                options = {};
                console.error("Error: ChemicalBuild options invalid.");
            }
        }
        else {
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
        for (const service of services) {
            if (options[service.name] === undefined) {
                options[service.name] = true;
            }
        }
        if (options.demoMode === undefined) {
            options.demoMode = false;
        }
        this.options = options;
    }
    async write(deletePath = false) {
        const dest = this.options.path || "";
        const absDest = dest.startsWith("/") ? dest : `${process.cwd()}/${dest}`;
        if (!(await Bun.file(absDest).exists())) {
            await Bun.$ `mkdir -p ${absDest}`;
        }
        else if (deletePath) {
            await Bun.$ `rm -rf ${absDest}`;
            await Bun.$ `mkdir -p ${absDest}`;
        }
        let chemicalMain = await Bun.file(ROOT + "client/chemical.js").text();
        if (this.options.default) {
            const serviceNames = services.map((s) => s.name);
            if (serviceNames.includes(this.options.default)) {
                chemicalMain =
                    `const defaultService = "${this.options.default}";\n\n` +
                        chemicalMain;
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
                    String(this.options[service.name]) +
                    ";\n" +
                    chemicalMain;
        }
        chemicalMain =
            "const demoMode = " +
                String(this.options.demoMode) +
                ";\n" +
                chemicalMain;
        chemicalMain = "(async () => {\n" + chemicalMain + "\n})();";
        await Bun.write(`${absDest}/chemical.js`, chemicalMain);
        let chemicalSW = await Bun.file(ROOT + "client/chemical.sw.js").text();
        for (const service of services) {
            chemicalSW =
                "const " +
                    service.name +
                    "Enabled = " +
                    String(this.options[service.name]) +
                    ";\n" +
                    chemicalSW;
        }
        await Bun.write(`${absDest}/chemical.sw.js`, chemicalSW);
        if (this.options.demoMode) {
            await Bun.write(`${absDest}/chemical.demo.html`, Bun.file(ROOT + "client/chemical.demo.html"));
        }
        await Bun.$ `cp -r ${baremuxPath} ${absDest}/baremux`;
        await Bun.$ `cp -r ${libcurlPath} ${absDest}/libcurl`;
        await Bun.$ `cp -r ${epoxyPath} ${absDest}/epoxy`;
        await Bun.$ `cp -r ${libcurlPath} ${absDest}/libcurl`;
        for (const service of services) {
            if (this.options[service.name] && service.nodePath) {
                await Bun.$ `cp -r ${service.nodePath} ${absDest}/${service.name}`;
            }
        }
    }
}
export { ChemicalServer, ChemicalBuild, ChemicalVitePlugin };
