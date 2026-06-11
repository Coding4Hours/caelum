import { createServer } from "node:http";
import express from "express";
//@ts-ignore
import { server as wisp, logging } from "@mercuryworkshop/wisp-js/server";
//@ts-ignore
import { baremuxPath } from "@mercuryworkshop/bare-mux/node";
import { libcurlPath } from "@mercuryworkshop/libcurl-transport";
import { epoxyPath } from "@mercuryworkshop/epoxy-transport";
import { services } from "./proxys";
import { CaelumVitePlugin } from "./vite-plugin";
const ROOT = new URL("..", import.meta.url).pathname;
logging.set_level(logging.ERROR);
class CaelumServer {
    constructor(options = {}) {
        if (options) {
            if (typeof options !== "object" || Array.isArray(options)) {
                options = {};
                console.error("Error: CaelumServer options invalid.");
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
        this.app.serveCaelum = this.serveCaelum;
    }
    [Symbol.iterator]() {
        return [this.app, this.listen][Symbol.iterator]();
    }
    serveCaelum = () => {
        this.app.get("/caelum.js", async (req, res) => {
            let caelumMain = await Bun.file(ROOT + "client/caelum.js").text();
            if (this.options.default) {
                const serviceNames = services.map((s) => s.name);
                if (serviceNames.includes(this.options.default)) {
                    caelumMain =
                        `const defaultService = "${this.options.default}";\n\n` +
                            caelumMain;
                }
                else {
                    caelumMain =
                        `const defaultService = "${serviceNames[0] || "scramjet"}";\n\n` +
                            caelumMain;
                    console.error("Error: Caelum default option invalid.");
                }
            }
            else {
                caelumMain = `const defaultService = "scramjet";\n\n` + caelumMain;
            }
            for (const service of services) {
                caelumMain =
                    "const " +
                        service.name +
                        "Enabled = " +
                        String(this.options[service.name]) +
                        ";\n" +
                        caelumMain;
            }
            caelumMain =
                "const demoMode = " +
                    String(this.options.demoMode) +
                    ";\n" +
                    caelumMain;
            caelumMain = "(async () => {\n" + caelumMain + "\n})();";
            res.type("application/javascript");
            return res.send(caelumMain);
        });
        this.app.get("/caelum.sw.js", async (req, res) => {
            let caelumSW = await Bun.file(ROOT + "client/caelum.sw.js").text();
            for (const service of services) {
                caelumSW =
                    "const " +
                        service.name +
                        "Enabled = " +
                        String(this.options[service.name]) +
                        ";\n" +
                        caelumSW;
            }
            res.type("application/javascript");
            return res.send(caelumSW);
        });
        this.app.use(express.static(ROOT + "client"));
        this.app.use("/baremux/", express.static(baremuxPath));
        this.app.use("/libcurl/", express.static(libcurlPath));
        this.app.use("/epoxy/", express.static(epoxyPath));
        for (const service of services) {
            if (this.options[service.name] && service.nodePath) {
                const paths = Array.isArray(service.nodePath)
                    ? service.nodePath
                    : [service.nodePath];
                for (const p of paths) {
                    this.app.use(service.staticUrl, express.static(p));
                }
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
class CaelumBuild {
    constructor(options) {
        if (options) {
            if (typeof options !== "object" || Array.isArray(options)) {
                options = {};
                console.error("Error: CaelumBuild options invalid.");
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
        let caelumMain = await Bun.file(ROOT + "client/caelum.js").text();
        if (this.options.default) {
            const serviceNames = services.map((s) => s.name);
            if (serviceNames.includes(this.options.default)) {
                caelumMain =
                    `const defaultService = "${this.options.default}";\n\n` +
                        caelumMain;
            }
            else {
                caelumMain =
                    `const defaultService = "${serviceNames[0] || "scramjet"}";\n\n` +
                        caelumMain;
                console.error("Error: Caelum default option invalid.");
            }
        }
        else {
            caelumMain = `const defaultService = "scramjet";\n\n` + caelumMain;
        }
        for (const service of services) {
            caelumMain =
                "const " +
                    service.name +
                    "Enabled = " +
                    String(this.options[service.name]) +
                    ";\n" +
                    caelumMain;
        }
        caelumMain =
            "const demoMode = " +
                String(this.options.demoMode) +
                ";\n" +
                caelumMain;
        caelumMain = "(async () => {\n" + caelumMain + "\n})();";
        await Bun.write(`${absDest}/caelum.js`, caelumMain);
        let caelumSW = await Bun.file(ROOT + "client/caelum.sw.js").text();
        for (const service of services) {
            caelumSW =
                "const " +
                    service.name +
                    "Enabled = " +
                    String(this.options[service.name]) +
                    ";\n" +
                    caelumSW;
        }
        await Bun.write(`${absDest}/caelum.sw.js`, caelumSW);
        if (this.options.demoMode) {
            await Bun.write(`${absDest}/caelum.demo.html`, Bun.file(ROOT + "client/caelum.demo.html"));
        }
        await Bun.$ `cp -r ${baremuxPath} ${absDest}/baremux`;
        await Bun.$ `cp -r ${libcurlPath} ${absDest}/libcurl`;
        await Bun.$ `cp -r ${epoxyPath} ${absDest}/epoxy`;
        await Bun.$ `cp -r ${libcurlPath} ${absDest}/libcurl`;
        for (const service of services) {
            if (this.options[service.name] && service.nodePath) {
                const paths = Array.isArray(service.nodePath)
                    ? service.nodePath
                    : [service.nodePath];
                for (const p of paths) {
                    await Bun.$ `cp -r ${p} ${absDest}/${service.name}`;
                }
            }
        }
    }
}
export { CaelumServer, CaelumBuild, CaelumVitePlugin };
