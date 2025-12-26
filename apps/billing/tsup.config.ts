import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  clean: true,
  external: [
    "@shipper/shared",
    "zod",
    "express",
    "cors",
    "stripe",
    "pino",
  ],
  noExternal: ["@shipper/database"],
  // Don't bundle Prisma's generated files - they need to stay external
  banner: {
    js: `import { createRequire } from 'module';const require = createRequire(import.meta.url);`,
  },
  shims: true,
  esbuildOptions(options) {
    options.external = [
      ...(options.external || []),
      "@prisma/client",
      ".prisma/client",
    ];
  },
});
