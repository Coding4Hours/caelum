import { uvPath } from "@titaniumnetwork-dev/ultraviolet";
import { nanoid } from "nanoid";

const uvRandomPath = nanoid(10);
const uvFolder = "ultraviolet/dist";

if (await Bun.file(uvFolder).exists()) {
  await Bun.$`rm -rf ${uvFolder}`;
}
await Bun.$`cp -r ${uvPath} ${uvFolder}`;
await Bun.write(`${uvFolder}/uv.config.js`, Bun.file("config/uv/uv.config.js"));

await Bun.$`rm -f ${uvFolder}/sw.js`;

const glob = new Bun.Glob("*");
const files = [...glob.scanSync({ cwd: uvFolder })].map(f => `${uvFolder}/${f}`);
const namedFiles = files.map(file => "uv/" + file.split("/dist/")[1]);

for (const file of files) {
  if (file.endsWith(".map")) {
    await Bun.$`rm -f ${file}`;
    continue;
  }

  let data = await Bun.file(file).text();
  for (const namedFile of namedFiles) {
    data = data.replace(
      new RegExp(namedFile, "g"),
      namedFile.replace(new RegExp("uv", "g"), uvRandomPath)
    );
    data = data.split("\n//# sourceMappingURL=")[0];
  }
  await Bun.write(file, data);
  const newName = file.replace(new RegExp("uv", "g"), uvRandomPath);
  await Bun.$`mv ${file} ${newName}`;
}

await Bun.write(
  "ultraviolet/path.js",
  `const uvRandomPath = "${uvRandomPath}";

export { uvRandomPath };`
);
