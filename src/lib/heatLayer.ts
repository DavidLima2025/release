import type * as Leaflet from "leaflet";

/**
 * Mapa de calor (densidade de Kernel) desenhado em canvas sobre o Leaflet.
 * Mesmo princípio do simpleheat: carimba um borrão por fato e colore pela intensidade acumulada.
 * O raio é em metros, então a mancha acompanha o zoom.
 */
export type HeatPoint = [number, number, number?];

const GRADIENT: Record<number, string> = { 0.25: "#2b83ba", 0.45: "#5ec2a6", 0.6: "#c7e9ad", 0.72: "#fee08b", 0.85: "#f46d43", 1: "#b2182b" };

function palette() {
  const c = document.createElement("canvas");
  c.width = 1; c.height = 256;
  const ctx = c.getContext("2d")!;
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  Object.entries(GRADIENT).forEach(([stop, color]) => g.addColorStop(Number(stop), color));
  ctx.fillStyle = g; ctx.fillRect(0, 0, 1, 256);
  return ctx.getImageData(0, 0, 1, 256).data;
}

export function createHeatLayer(L: typeof Leaflet, points: HeatPoint[], options: { radiusMeters?: number; opacity?: number } = {}) {
  const radiusMeters = options.radiusMeters ?? 250;
  const opacity = options.opacity ?? 0.75;
  let colors: Uint8ClampedArray | null = null;

  const Heat = (L.Layer as any).extend({
    onAdd(this: any, map: Leaflet.Map) {
      this._map = map;
      const canvas = (this._canvas = L.DomUtil.create("canvas", "leaflet-layer leaflet-zoom-hide") as HTMLCanvasElement);
      canvas.style.pointerEvents = "none";
      canvas.style.opacity = String(opacity);
      map.getPanes().overlayPane.appendChild(canvas);
      map.on("moveend zoomend resize viewreset", this._reset, this);
      this._reset();
    },
    onRemove(this: any, map: Leaflet.Map) {
      map.off("moveend zoomend resize viewreset", this._reset, this);
      this._canvas.remove();
    },
    _reset(this: any) {
      const map: Leaflet.Map = this._map;
      const size = map.getSize();
      const canvas: HTMLCanvasElement = this._canvas;
      L.DomUtil.setPosition(canvas, map.containerPointToLayerPoint([0, 0]));
      canvas.width = size.x; canvas.height = size.y;
      this._draw();
    },
    _draw(this: any) {
      const map: Leaflet.Map = this._map;
      const canvas: HTMLCanvasElement = this._canvas;
      const ctx = canvas.getContext("2d")!;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (!points.length) return;
      // Raio em pixels a partir de metros na latitude do centro.
      const center = map.getCenter();
      const p1 = map.latLngToContainerPoint(center);
      const p2 = map.latLngToContainerPoint(L.latLng(center.lat, center.lng + radiusMeters / (111320 * Math.cos((center.lat * Math.PI) / 180))));
      const r = Math.max(6, Math.min(140, Math.abs(p2.x - p1.x)));
      const blur = r * 0.85;
      const stamp = document.createElement("canvas");
      const size = Math.ceil((r + blur) * 2);
      stamp.width = stamp.height = size;
      const sctx = stamp.getContext("2d")!;
      sctx.shadowOffsetX = sctx.shadowOffsetY = size * 2;
      sctx.shadowBlur = blur;
      sctx.shadowColor = "black";
      sctx.beginPath();
      sctx.arc(size / 2 - size * 2, size / 2 - size * 2, r * 0.6, 0, Math.PI * 2);
      sctx.fill();
      const max = Math.max(1, ...points.map((p) => p[2] ?? 1)) * 1.6;
      for (const [lat, lng, w] of points) {
        const pt = map.latLngToContainerPoint([lat, lng]);
        if (pt.x < -size || pt.y < -size || pt.x > canvas.width + size || pt.y > canvas.height + size) continue;
        ctx.globalAlpha = Math.min(1, Math.max(0.08, (w ?? 1) / max));
        ctx.drawImage(stamp, pt.x - size / 2, pt.y - size / 2);
      }
      ctx.globalAlpha = 1;
      if (!canvas.width || !canvas.height) return;
      colors ||= palette();
      const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const px = img.data;
      for (let i = 3; i < px.length; i += 4) {
        const a = px[i];
        if (!a) continue;
        const j = a * 4;
        px[i - 3] = colors[j]; px[i - 2] = colors[j + 1]; px[i - 1] = colors[j + 2];
        px[i] = Math.min(255, a * 1.6);
      }
      ctx.putImageData(img, 0, 0);
    },
  });
  return new Heat() as Leaflet.Layer;
}
