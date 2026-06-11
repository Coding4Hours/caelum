import { scramjetPath } from "@mercuryworkshop/scramjet/path";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { Service } from "../services";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const controllerPath = resolve(
  __dirname,
  "../../node_modules/@mercuryworkshop/scramjet-controller/dist",
);

export const scramjet: Service = {
  name: "scramjet",
  staticUrl: "/scramjet/",
  nodePath: [scramjetPath, controllerPath],
};
