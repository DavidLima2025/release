/**
 * Leitor de ZIP mínimo, sem dependências (usa o DecompressionStream do navegador).
 * Serve para abrir o .zip que o Google Drive gera ao baixar uma pasta.
 */

const CP437_HIGH =
  "ÇüéâäàåçêëèïîìÄÅÉæÆôöòûùÿÖÜ¢£¥₧ƒáíóúñÑªº¿⌐¬½¼¡«»░▒▓│┤╡╢╖╕╣║╗╝╜╛┐└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀αßΓπΣσµτΦΘΩδ∞φε∩≡±≥≤⌠⌡÷≈°∙·√ⁿ²■ ";

function decodeName(bytes: Uint8Array, utf8Flag: boolean) {
  if (utf8Flag) return new TextDecoder("utf-8").decode(bytes);
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return Array.from(bytes, (b) => (b < 128 ? String.fromCharCode(b) : CP437_HIGH[b - 128])).join("");
  }
}

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream("deflate-raw" as CompressionFormat));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

const MIME: Record<string, string> = {
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif", bmp: "image/bmp",
  heic: "image/heic", heif: "image/heif", pdf: "application/pdf",
};

export function mimeOf(name: string) {
  return MIME[name.split(".").pop()?.toLowerCase() || ""] || "application/octet-stream";
}

/** Extrai os arquivos de um .zip. `accept` filtra pelo nome antes de descompactar. */
export async function unzip(file: Blob, accept: (name: string) => boolean = () => true): Promise<File[]> {
  const buf = new Uint8Array(await file.arrayBuffer());
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);

  // Fim do diretório central (fica nos últimos 64 KB do arquivo).
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i -= 1) {
    if (view.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error("Arquivo .zip inválido ou corrompido.");

  let count = view.getUint16(eocd + 10, true);
  let offset = view.getUint32(eocd + 16, true);

  // ZIP64 (pastas muito grandes).
  if (offset === 0xffffffff || count === 0xffff) {
    const locator = eocd - 20;
    if (locator >= 0 && view.getUint32(locator, true) === 0x07064b50) {
      const z64 = Number(view.getBigUint64(locator + 8, true));
      count = Number(view.getBigUint64(z64 + 32, true));
      offset = Number(view.getBigUint64(z64 + 48, true));
    }
  }

  const out: File[] = [];
  for (let n = 0; n < count; n += 1) {
    if (view.getUint32(offset, true) !== 0x02014b50) break;
    const flags = view.getUint16(offset + 8, true);
    const method = view.getUint16(offset + 10, true);
    let compSize = view.getUint32(offset + 20, true);
    const nameLen = view.getUint16(offset + 28, true);
    const extraLen = view.getUint16(offset + 30, true);
    const commentLen = view.getUint16(offset + 32, true);
    let localOffset = view.getUint32(offset + 42, true);
    const name = decodeName(buf.subarray(offset + 46, offset + 46 + nameLen), Boolean(flags & 0x800));

    // Campos ZIP64 no "extra".
    if (compSize === 0xffffffff || localOffset === 0xffffffff) {
      let p = offset + 46 + nameLen;
      const end = p + extraLen;
      while (p + 4 <= end) {
        const id = view.getUint16(p, true);
        const size = view.getUint16(p + 2, true);
        if (id === 0x0001) {
          let q = p + 4;
          const uncomp = view.getUint32(offset + 24, true);
          if (uncomp === 0xffffffff) q += 8;
          if (compSize === 0xffffffff) { compSize = Number(view.getBigUint64(q, true)); q += 8; }
          if (localOffset === 0xffffffff) localOffset = Number(view.getBigUint64(q, true));
        }
        p += 4 + size;
      }
    }
    offset += 46 + nameLen + extraLen + commentLen;

    const base = name.split("/").pop() || "";
    if (!base || name.endsWith("/") || base.startsWith(".") || name.includes("__MACOSX") || !accept(base)) continue;
    if (flags & 0x1) continue; // criptografado

    const localNameLen = view.getUint16(localOffset + 26, true);
    const localExtraLen = view.getUint16(localOffset + 28, true);
    const start = localOffset + 30 + localNameLen + localExtraLen;
    const raw = buf.subarray(start, start + compSize);
    let content: Uint8Array;
    if (method === 0) content = raw;
    else if (method === 8) content = await inflateRaw(raw);
    else continue;
    out.push(new File([content as BlobPart], base, { type: mimeOf(base) }));
  }
  return out;
}
