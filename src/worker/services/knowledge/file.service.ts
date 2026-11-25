import { ALLOWED_UPLOAD_TYPES, MAX_UPLOAD_BYTES, type StoredFile } from "../../../shared/knowledge";
import { uuidv7 } from "../../../shared/uuid";
import { AppError, assertLive } from "../../lib/errors";
import type { FileRepository, FileRow } from "../../repositories/knowledge/library.repository";
import { isoRequired } from "../../repositories/_shared";

type AllowedType = (typeof ALLOWED_UPLOAD_TYPES)[number];

/**
 * Detects the real file type from its first bytes ("magic numbers").
 * The browser-declared type and the extension are NOT trusted. SVG is
 * deliberately unsupported (it can carry scripts).
 */
export function sniffType(bytes: Uint8Array): AllowedType | null {
  const startsWith = (...sig: number[]) => sig.every((b, i) => bytes[i] === b);
  if (startsWith(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return "image/png";
  if (startsWith(0xff, 0xd8, 0xff)) return "image/jpeg";
  if (startsWith(0x47, 0x49, 0x46, 0x38)) return "image/gif";
  if (startsWith(0x52, 0x49, 0x46, 0x46) && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return "image/webp";
  if (startsWith(0x25, 0x50, 0x44, 0x46, 0x2d)) return "application/pdf";
  return null;
}

/** Keeps a display name only: no paths, no control chars, bounded length. */
export function cleanFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "arquivo";
  const cleaned = base.replace(/[\u0000-\u001f\u007f"<>|:*?]/g, "_").trim().slice(0, 200);
  return cleaned || "arquivo";
}

async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export class FileService {
  constructor(private readonly repo: FileRepository, private readonly bucket: R2Bucket) {}

  async upload(file: File): Promise<StoredFile> {
    if (file.size === 0) throw new AppError(400, "VALIDATION_FAILED", "Arquivo vazio");
    if (file.size > MAX_UPLOAD_BYTES) throw new AppError(413, "PAYLOAD_TOO_LARGE", `Arquivo maior que ${MAX_UPLOAD_BYTES / 1024 / 1024} MB`);
    const bytes = await file.arrayBuffer();
    const type = sniffType(new Uint8Array(bytes, 0, Math.min(16, bytes.byteLength)));
    if (!type) throw new AppError(415, "UNSUPPORTED_MEDIA_TYPE", "Tipo de arquivo não suportado (PNG, JPEG, GIF, WebP ou PDF)");

    const id = uuidv7();
    const key = `files/${id}`; // never derived from the user-supplied name
    const sha256 = await sha256Hex(bytes);
    await this.bucket.put(key, bytes, { httpMetadata: { contentType: type }, customMetadata: { sha256 }, sha256 });
    try {
      const row = await this.repo.insert({ id, r2Key: key, originalName: cleanFileName(file.name), mimeType: type, sizeBytes: file.size, sha256 });
      return toDto(row);
    } catch (err) {
      await this.bucket.delete(key); // compensate: no orphan objects
      throw err;
    }
  }

  async open(id: string): Promise<{ row: FileRow; body: ReadableStream }> {
    const row = assertLive(await this.repo.findById(id), "Arquivo");
    const object = await this.bucket.get(row.r2Key);
    if (!object) throw new AppError(404, "NOT_FOUND", "Conteúdo do arquivo ausente no armazenamento");
    return { row, body: object.body };
  }

  async get(id: string): Promise<StoredFile> {
    return toDto(assertLive(await this.repo.findById(id), "Arquivo"));
  }
}

function toDto(r: FileRow): StoredFile {
  return { id: r.id, url: `/api/files/${r.id}`, originalName: r.originalName, mimeType: r.mimeType, sizeBytes: r.sizeBytes, sha256: r.sha256, createdAt: isoRequired(r.createdAt) };
}
