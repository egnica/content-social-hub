import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";

// Exercise server modules against injected providers/storage; never contact live APIs.
export async function loadWithStubs(url, stubs) {
  const source = (await readFile(url, "utf8"))
    .replace(/^import\s+["'][^"']+["'];\s*$/gm, "")
    .replace(/^import\s+[\s\S]*?\sfrom\s+["'][^"']+["'];/gm, "");
  const key = randomUUID();
  globalThis[key] = stubs;
  try {
    return await import(
      `data:text/javascript;base64,${Buffer.from(`const {${Object.keys(stubs).join(",")}} = globalThis[${JSON.stringify(key)}];\n${source}`).toString("base64")}`
    );
  } finally {
    delete globalThis[key];
  }
}
