/**
 * Attachment operations for PLANKA API.
 *
 * File uploads are restricted to PLANKA_UPLOAD_DIR: every path is resolved
 * with fs.realpath (following symlinks) and must end up inside the equally
 * resolved base directory. Without PLANKA_UPLOAD_DIR the upload tool is
 * disabled entirely.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { plankaClient } from "../client.js";
import { Attachment } from "../schemas/entities.js";
import {
  AddAttachmentSchema,
  AddAttachmentInput,
  AddLinkAttachmentSchema,
  AddLinkAttachmentInput,
} from "../schemas/requests.js";
import { AttachmentResponse } from "../schemas/responses.js";
import { PlankaConfigError, PlankaValidationError } from "../errors.js";

/**
 * Returns the configured upload base directory, or null if uploads are disabled.
 */
export function getUploadDir(): string | null {
  const dir = process.env.PLANKA_UPLOAD_DIR;
  return dir && dir.trim() !== "" ? dir : null;
}

/**
 * Resolves filePath against the upload base directory and verifies that the
 * fully resolved file (symlinks included) stays inside the fully resolved
 * base directory. Returns the real path of the file.
 *
 * Rejects with PlankaValidationError on any escape attempt (../, absolute
 * paths outside the base, symlinks pointing outside) and on missing files.
 */
export async function resolveUploadPath(
  filePath: string,
  uploadDir: string
): Promise<string> {
  let realBase: string;
  try {
    realBase = await fs.realpath(uploadDir);
  } catch {
    throw new PlankaConfigError(
      `PLANKA_UPLOAD_DIR does not exist or is not accessible: ${uploadDir}`
    );
  }

  // Relative paths are interpreted relative to the upload directory
  const candidate = path.resolve(realBase, filePath);

  let realTarget: string;
  try {
    realTarget = await fs.realpath(candidate);
  } catch {
    throw new PlankaValidationError(
      `File not found: ${filePath} (resolved to ${candidate}). ` +
        `Paths are resolved relative to PLANKA_UPLOAD_DIR.`
    );
  }

  const isInside =
    realTarget === realBase ||
    realTarget.startsWith(realBase + path.sep);

  if (!isInside) {
    throw new PlankaValidationError(
      `Access denied: ${filePath} resolves to ${realTarget}, which is outside ` +
        `the allowed upload directory ${realBase}. Only files inside ` +
        `PLANKA_UPLOAD_DIR can be attached.`
    );
  }

  const stat = await fs.stat(realTarget);
  if (!stat.isFile()) {
    throw new PlankaValidationError(
      `Not a regular file: ${filePath} (resolved to ${realTarget})`
    );
  }

  return realTarget;
}

/**
 * Upload a file from PLANKA_UPLOAD_DIR as an attachment on a card.
 * POST /cards/{cardId}/attachments (multipart/form-data, type=file).
 */
export async function addAttachment(
  input: AddAttachmentInput
): Promise<Attachment> {
  const validated = AddAttachmentSchema.parse(input);

  const uploadDir = getUploadDir();
  if (!uploadDir) {
    throw new PlankaConfigError(
      "Attachment upload is disabled: set PLANKA_UPLOAD_DIR to the directory " +
        "that files may be uploaded from."
    );
  }

  const realPath = await resolveUploadPath(validated.filePath, uploadDir);
  const fileName = path.basename(realPath);
  const data = await fs.readFile(realPath);

  const form = new FormData();
  form.append("type", "file");
  form.append("name", validated.name ?? fileName);
  form.append("file", new Blob([new Uint8Array(data)]), fileName);

  const response = await plankaClient.postForm<unknown>(
    `/api/cards/${validated.cardId}/attachments`,
    form
  );

  const parsed = AttachmentResponse.parse(response);
  return parsed.item;
}

/**
 * Attach a URL as a link attachment on a card.
 * POST /cards/{cardId}/attachments (multipart/form-data, type=link).
 * Independent of PLANKA_UPLOAD_DIR — no local file is involved.
 */
export async function addLinkAttachment(
  input: AddLinkAttachmentInput
): Promise<Attachment> {
  const validated = AddLinkAttachmentSchema.parse(input);

  const form = new FormData();
  form.append("type", "link");
  form.append("url", validated.url);
  // name is required by the API; fall back to the URL (capped at 128 chars)
  form.append("name", validated.name ?? validated.url.slice(0, 128));

  const response = await plankaClient.postForm<unknown>(
    `/api/cards/${validated.cardId}/attachments`,
    form
  );

  const parsed = AttachmentResponse.parse(response);
  return parsed.item;
}
