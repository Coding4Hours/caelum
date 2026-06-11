import { scramjetPath } from "@mercuryworkshop/scramjet/path";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { Service } from "../services";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const nodeModules = resolve(__dirname, "../../node_modules");

export const controllerDist = resolve(
  nodeModules,
  "@mercuryworkshop/scramjet-controller/dist",
);
export const epoxyDist = resolve(
  nodeModules,
  "@mercuryworkshop/epoxy-transport/dist",
);
export const libcurlDist = resolve(
  nodeModules,
  "@mercuryworkshop/libcurl-transport/dist",
);

export const scramjet: Service = {
  name: "scramjet",
  staticUrl: "/scramjet/",
  nodePath: [scramjetPath],
};
