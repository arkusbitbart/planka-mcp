/**
 * Tests for the attachment upload path sandbox.
 *
 * The security requirement: filePath may only resolve to files inside
 * PLANKA_UPLOAD_DIR. Escapes via ../ and via symlinks must be rejected.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  resolveUploadPath,
  addAttachment,
  getUploadDir,
} from "../src/operations/attachments.js";
import { PlankaConfigError, PlankaValidationError } from "../src/errors.js";

let root: string; // temp root containing everything
let uploadDir: string; // the allowed base directory
let outsideDir: string; // a sibling directory outside the base

beforeAll(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "planka-mcp-test-"));
  uploadDir = path.join(root, "uploads");
  outsideDir = path.join(root, "outside");
  await fs.mkdir(uploadDir, { recursive: true });
  await fs.mkdir(path.join(uploadDir, "sub"), { recursive: true });
  await fs.mkdir(outsideDir, { recursive: true });

  await fs.writeFile(path.join(uploadDir, "inside.txt"), "inside");
  await fs.writeFile(path.join(uploadDir, "sub", "nested.txt"), "nested");
  await fs.writeFile(path.join(outsideDir, "secret.txt"), "secret");

  // Symlink inside the upload dir pointing to a file outside it
  await fs.symlink(
    path.join(outsideDir, "secret.txt"),
    path.join(uploadDir, "sneaky-link.txt")
  );
  // Symlink inside the upload dir pointing to a directory outside it
  await fs.symlink(outsideDir, path.join(uploadDir, "sneaky-dir"));
  // Symlink pointing to a file inside the upload dir (allowed)
  await fs.symlink(
    path.join(uploadDir, "inside.txt"),
    path.join(uploadDir, "friendly-link.txt")
  );
});

afterAll(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

describe("resolveUploadPath", () => {
  it("accepts a relative path inside the upload dir", async () => {
    const resolved = await resolveUploadPath("inside.txt", uploadDir);
    expect(resolved).toBe(await fs.realpath(path.join(uploadDir, "inside.txt")));
  });

  it("accepts a nested relative path", async () => {
    const resolved = await resolveUploadPath("sub/nested.txt", uploadDir);
    expect(resolved).toBe(
      await fs.realpath(path.join(uploadDir, "sub", "nested.txt"))
    );
  });

  it("accepts an absolute path inside the upload dir", async () => {
    const resolved = await resolveUploadPath(
      path.join(uploadDir, "inside.txt"),
      uploadDir
    );
    expect(resolved).toBe(await fs.realpath(path.join(uploadDir, "inside.txt")));
  });

  it("accepts a symlink that stays inside the upload dir", async () => {
    const resolved = await resolveUploadPath("friendly-link.txt", uploadDir);
    expect(resolved).toBe(await fs.realpath(path.join(uploadDir, "inside.txt")));
  });

  it("rejects ../ escape to a sibling directory", async () => {
    await expect(
      resolveUploadPath("../outside/secret.txt", uploadDir)
    ).rejects.toThrow(PlankaValidationError);
  });

  it("rejects deep ../ escape", async () => {
    await expect(
      resolveUploadPath("sub/../../outside/secret.txt", uploadDir)
    ).rejects.toThrow(PlankaValidationError);
  });

  it("rejects an absolute path outside the upload dir", async () => {
    await expect(
      resolveUploadPath(path.join(outsideDir, "secret.txt"), uploadDir)
    ).rejects.toThrow(PlankaValidationError);
  });

  it("rejects a symlinked file pointing outside the upload dir", async () => {
    await expect(
      resolveUploadPath("sneaky-link.txt", uploadDir)
    ).rejects.toThrow(/outside/);
  });

  it("rejects a path through a symlinked directory pointing outside", async () => {
    await expect(
      resolveUploadPath("sneaky-dir/secret.txt", uploadDir)
    ).rejects.toThrow(/outside/);
  });

  it("rejects a sibling directory whose name shares the base as prefix", async () => {
    // /root/uploads-evil must not pass a naive startsWith("/root/uploads") check
    const evilDir = uploadDir + "-evil";
    await fs.mkdir(evilDir, { recursive: true });
    await fs.writeFile(path.join(evilDir, "evil.txt"), "evil");
    await expect(
      resolveUploadPath(path.join(evilDir, "evil.txt"), uploadDir)
    ).rejects.toThrow(PlankaValidationError);
  });

  it("rejects a missing file with a clear message", async () => {
    await expect(
      resolveUploadPath("does-not-exist.txt", uploadDir)
    ).rejects.toThrow(/not found/i);
  });

  it("rejects a directory instead of a file", async () => {
    await expect(resolveUploadPath("sub", uploadDir)).rejects.toThrow(
      /not a regular file/i
    );
  });

  it("fails with a config error when the upload dir itself is missing", async () => {
    await expect(
      resolveUploadPath("inside.txt", path.join(root, "missing-base"))
    ).rejects.toThrow(PlankaConfigError);
  });

  it("works when PLANKA_UPLOAD_DIR ends with a trailing slash", async () => {
    const resolved = await resolveUploadPath("inside.txt", uploadDir + path.sep);
    expect(resolved).toBe(await fs.realpath(path.join(uploadDir, "inside.txt")));
    await expect(
      resolveUploadPath("../outside/secret.txt", uploadDir + path.sep)
    ).rejects.toThrow(PlankaValidationError);
  });

  it("holds when PLANKA_UPLOAD_DIR itself is a symlink", async () => {
    const baseLink = path.join(root, "uploads-link");
    await fs.symlink(uploadDir, baseLink);

    // Inside file still accepted, resolved against the real base
    const resolved = await resolveUploadPath("inside.txt", baseLink);
    expect(resolved).toBe(await fs.realpath(path.join(uploadDir, "inside.txt")));

    // Escapes are still rejected
    await expect(
      resolveUploadPath("../outside/secret.txt", baseLink)
    ).rejects.toThrow(PlankaValidationError);
    await expect(
      resolveUploadPath("sneaky-link.txt", baseLink)
    ).rejects.toThrow(/outside/);
  });
});

describe("addAttachment / getUploadDir without PLANKA_UPLOAD_DIR", () => {
  let saved: string | undefined;

  beforeEach(() => {
    saved = process.env.PLANKA_UPLOAD_DIR;
    delete process.env.PLANKA_UPLOAD_DIR;
  });

  afterEach(() => {
    if (saved !== undefined) {
      process.env.PLANKA_UPLOAD_DIR = saved;
    } else {
      delete process.env.PLANKA_UPLOAD_DIR;
    }
  });

  it("getUploadDir returns null when unset", () => {
    expect(getUploadDir()).toBeNull();
  });

  it("getUploadDir returns null for an empty value", () => {
    process.env.PLANKA_UPLOAD_DIR = "   ";
    expect(getUploadDir()).toBeNull();
  });

  it("addAttachment is disabled when PLANKA_UPLOAD_DIR is unset", async () => {
    await expect(
      addAttachment({ cardId: "1", filePath: "anything.txt" })
    ).rejects.toThrow(PlankaConfigError);
  });
});
