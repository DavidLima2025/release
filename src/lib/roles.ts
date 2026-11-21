// Catálogo de papéis (funções) dos alvos: criar e excluir. Fica na tabela target_roles.
// Os papéis em uso alimentam três listas que o resto do sistema já lê (TARGET_ROLES, ROLE_COLOR, AUTO_GROUPS),
// que são atualizadas no lugar quando o catálogo carrega — assim PDF, PPTX, quadro e legendas seguem o catálogo.
import { ROLE_COLOR, TARGET_ROLES } from "./investigation";
import { AUTO_GROUPS } from "./orgBoard";

export type RoleDef = { id?: string; name: string; color: string; /** linha no quadro: 0 = topo */ level: number; /** núcleo automático */ group: string };

/** Os papéis que o sistema sempre teve (usados se o catálogo não carregar). */
export const DEFAULT_ROLES: RoleDef[] = TARGET_ROLES.map((name) => ({ name, color: ROLE_COLOR[name] || "#6B655A", level: AUTO_GROUPS[name]?.level ?? 3, group: AUTO_GROUPS[name]?.name || name.toUpperCase() }));

let version = 0;
/** Muda a cada vez que o catálogo é aplicado (para recalcular o que depende dele). */
export const roleCatalogVersion = () => version;

export function applyRoleCatalog(list: RoleDef[]) {
  const roles = list.length ? list : DEFAULT_ROLES;
  TARGET_ROLES.length = 0;
  for (const k of Object.keys(ROLE_COLOR)) delete ROLE_COLOR[k];
  for (const k of Object.keys(AUTO_GROUPS)) delete AUTO_GROUPS[k];
  for (const r of roles) {
    TARGET_ROLES.push(r.name);
    ROLE_COLOR[r.name] = r.color;
    AUTO_GROUPS[r.name] = { name: r.group || r.name.toUpperCase(), level: r.level };
  }
  version += 1;
}

export function normalizeRole(row: any): RoleDef {
  const level = Number(row.level);
  return {
    id: row.id, name: String(row.name || ""), color: /^#[0-9A-Fa-f]{6}$/.test(row.color || "") ? row.color : "#6B655A",
    level: Number.isFinite(level) ? Math.min(6, Math.max(0, Math.round(level))) : 3, group: String(row.group_name || "").trim(),
  };
}

export const sameRole = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
