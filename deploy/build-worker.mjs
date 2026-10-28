import { build } from "esbuild";
await build({ entryPoints: ["src/worker.js"], bundle: true, format: "esm", outfile: "dist/worker.js", loader: { ".json": "json" }, minify: true });
console.log("built dist/worker.js");
