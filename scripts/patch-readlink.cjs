"use strict";

/**
 * Build-time-only patch loaded via NODE_OPTIONS=--require.
 *
 * Some Node 22.x builds on Windows / NTFS return EISDIR (instead of the
 * POSIX-correct EINVAL) when fs.readlink is called on a regular,
 * non-symlink file. webpack's enhanced-resolve snapshotter only tolerates
 * EINVAL/ENOENT and surfaces anything else as a fatal build error
 * ("EISDIR: illegal operation on a directory, readlink ...").
 *
 * We normalize the error so webpack sees the expected EINVAL and treats
 * the path as a regular file. This is loaded into every Node process
 * spawned by `next build` / `next dev` (including webpack workers) via
 * NODE_OPTIONS.
 *
 * No application logic is affected — this only runs in the build/dev
 * tooling processes and does not get bundled into the app.
 */

const fs = require("node:fs");

function normalizeReadlinkError(err, path) {
  if (err && err.code === "EISDIR") {
    const fixed = new Error(
      "EINVAL: invalid argument, readlink '" + String(path) + "'",
    );
    fixed.code = "EINVAL";
    fixed.errno = -22;
    fixed.syscall = "readlink";
    fixed.path = String(path);
    return fixed;
  }
  return err;
}

const origSync = fs.readlinkSync;
fs.readlinkSync = function patchedReadlinkSync() {
  try {
    return origSync.apply(this, arguments);
  } catch (err) {
    throw normalizeReadlinkError(err, arguments[0]);
  }
};

const origAsync = fs.readlink;
fs.readlink = function patchedReadlink() {
  const args = Array.prototype.slice.call(arguments);
  const path = args[0];
  const cb = args[args.length - 1];
  if (typeof cb !== "function") {
    return origAsync.apply(this, args);
  }
  args[args.length - 1] = function (err, result) {
    if (err) return cb(normalizeReadlinkError(err, path), undefined);
    return cb(null, result);
  };
  return origAsync.apply(this, args);
};

if (fs.promises && fs.promises.readlink) {
  const origP = fs.promises.readlink;
  fs.promises.readlink = function patchedPromisesReadlink() {
    const args = arguments;
    return origP.apply(this, args).catch(function (err) {
      throw normalizeReadlinkError(err, args[0]);
    });
  };
}
