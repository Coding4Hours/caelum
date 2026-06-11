import { scramjetPath } from "@mercuryworkshop/scramjet/path";
import type { Service } from "../services";

export const scramjet: Service = {
  name: "scramjet",
  staticUrl: "/scramjet/",
  nodePath: scramjetPath,
};
