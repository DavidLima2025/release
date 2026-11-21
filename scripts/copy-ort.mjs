// Copia o motor WebAssembly do ONNX Runtime Web (pacote onnxruntime-web) para public/ort, para o site
// carregar do próprio domínio. Usado pela opção "buffalo_l" do Comparar faces. Nunca derruba o build:
// se algo faltar, só essa opção fica indisponível (o modelo padrão continua funcionando).
import fs from "fs"; import path from "path";
try {
  const src = path.resolve("node_modules/onnxruntime-web/dist");
  const dst = path.resolve("public/ort");
  if (!fs.existsSync(src)) { console.warn("[ort] onnxruntime-web não encontrado em", src, "— a opção buffalo_l ficará indisponível."); }
  else {
    fs.mkdirSync(dst, { recursive: true });
    const plain = ["ort-wasm-simd-threaded.mjs", "ort-wasm-simd-threaded.wasm"].filter((f) => fs.existsSync(path.join(src, f)));
    // Se o pacote não trouxer o par padrão, copia as variantes que existirem.
    const files = plain.length === 2 ? plain : fs.readdirSync(src).filter((f) => /^ort-wasm.*\.(mjs|wasm)$/.test(f));
    for (const f of files) fs.copyFileSync(path.join(src, f), path.join(dst, f));
    console.log(`[ort] ${files.length} arquivo(s) copiados para public/ort:`, files.join(", ") || "(nenhum)");
  }
} catch (e) { console.warn("[ort] não foi possível copiar o motor:", e?.message || e); }
process.exit(0);
