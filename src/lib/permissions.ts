export const ROLE_ORDER = ["OWNER", "ADMIN", "EDITOR", "STUDENT"] as const;
export type PlatformRole = (typeof ROLE_ORDER)[number];
export type Member = { id: string; role?: string };
export const ROLE_INFO: Record<PlatformRole, { label: string; description: string; rank: number }> = {
  OWNER: { label: "Власник", rank: 4, description: "Повний доступ до платформи. Призначає власників і адміністраторів та керує всіма нижчими ролями." },
  ADMIN: { label: "Адміністратор", rank: 3, description: "Керує платформою, матеріалами й інтеграціями. Призначає редакторів та учнів. Повні резервні копії доступні власнику." },
  EDITOR: { label: "Редактор", rank: 2, description: "Створює та редагує спільні теми, уроки, відео й завдання. Не керує ролями та резервними копіями." },
  STUDENT: { label: "Учень", rank: 1, description: "Навчається, проходить тести та веде власні нотатки. Бачить свої результати й прогрес." },
};
export function isPlatformRole(value: string): value is PlatformRole { return ROLE_ORDER.includes(value as PlatformRole); }
export function effectiveRole(user: Member): PlatformRole { return user.id === "owner" ? "OWNER" : user.role && isPlatformRole(user.role) ? user.role : "STUDENT"; }
export function isOwner(user: Member) { return effectiveRole(user) === "OWNER"; }
export function isAdministrator(user: Member) { return ROLE_INFO[effectiveRole(user)].rank >= ROLE_INFO.ADMIN.rank; }
export function canEditContent(user: Member) { return ROLE_INFO[effectiveRole(user)].rank >= ROLE_INFO.EDITOR.rank; }
export function canManageRole(actor: Member, target: Member, nextRole: PlatformRole) {
  if (actor.id === target.id || target.id === "owner") return false;
  const rank = ROLE_INFO[effectiveRole(actor)].rank;
  return isOwner(actor) || (rank >= ROLE_INFO.ADMIN.rank && ROLE_INFO[effectiveRole(target)].rank < rank && ROLE_INFO[nextRole].rank < rank);
}
