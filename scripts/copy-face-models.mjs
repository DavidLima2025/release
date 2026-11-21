// Copia os pesos do reconhecimento facial (pacote @vladmandic/face-api) para public/models/face,
// para o site carregar o modelo do próprio domínio — nenhuma foto sai do navegador.
import fs from "fs"; import path from "path";
const src = path.resolve("node_modules/@vladmandic/face-api/model");
const dst = path.resolve("public/models/face");
const WANT = /^(ssd_mobilenetv1|face_landmark_68_model|face_recognition_model)/;
if (!fs.existsSync(src)) { console.warn("[face] modelo não encontrado em", src, "— comparação facial ficará indisponível."); process.exit(0); }
fs.mkdirSync(dst, { recursive: true });
let n = 0;
for (const f of fs.readdirSync(src)) if (WANT.test(f)) { fs.copyFileSync(path.join(src, f), path.join(dst, f)); n += 1; }
console.log(`[face] ${n} arquivo(s) do modelo copiados para public/models/face`);
