import { mimeOf } from "./zip";

/** Fotos grandes são reduzidas (lado maior 1600 px, JPEG) para economizar espaço e acelerar os relatórios. */
export async function shrinkImage(original: File): Promise<File> {
  // Fotos vindas do Google Fotos/galeria do celular às vezes chegam sem tipo: completa pelo nome.
  const type = original.type || mimeOf(original.name);
  const file = original.type ? original : new File([original], original.name, { type });
  if (file.size < 1.5 * 1024 * 1024 || !/^image\/(jpeg|png|webp|bmp)$/.test(type)) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", 0.88));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.[a-z0-9]+$/i, ".jpg"), { type: "image/jpeg" });
  } catch {
    return file;
  }
}

