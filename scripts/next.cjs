"use strict";

/**
 * Wrapper around the `next` CLI that injects ./scripts/patch-readlink.cjs
 * into NODE_OPTIONS for the next process and every child process it
 * spawns (notably the webpack workers).
 *
 * See ./patch-readlink.cjs for the rationale: some Node 22.x builds on
 * Windows return EISDIR instead of EINVAL from fs.readlink for regular
 * files, which causes `next build` to fail with
 * "EISDIR: illegal operation on a directory, readlink ...".
 *
 * Usage (from package.json scripts):
 *   "build": "node ./scripts/next.cjs build"
 *   "dev":   "node ./scripts/next.cjs dev"
 */

const { spawn } = require("node:child_process");
const path = require("node:path");

// NODE_OPTIONS is parsed with shell-like rules: backslashes are escape
// characters. Use forward slashes (Node accepts them on Windows) so the
// path survives intact in every spawned child process.
const patchPath = path
  .resolve(__dirname, "patch-readlink.cjs")
  .replace(/\\/g, "/");
const requireFlag = `--require "${patchPath}"`;
const existing = process.env.NODE_OPTIONS || "";
const NODE_OPTIONS = existing.includes(patchPath)
  ? existing
  : existing
    ? `${existing} ${requireFlag}`
    : requireFlag;

const nextBin = require.resolve("next/dist/bin/next");
const args = process.argv.slice(2);

// Always run Next from the package root so it discovers .env.local /
// .env.* and resolves `next.config.ts` relative to the project, even if
// this wrapper is ever invoked from a different working directory.
const projectRoot = path.resolve(__dirname, "..");

const child = spawn(process.execPath, [nextBin, ...args], {
  stdio: "inherit",
  cwd: projectRoot,
  env: { ...process.env, NODE_OPTIONS },
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
