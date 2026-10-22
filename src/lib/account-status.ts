export const ACCOUNT_STATUSES = ["PENDING", "APPROVED", "REJECTED"] as const;
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

export type AccountSubject = { id?: string; accountStatus?: string | null };

export function accountStatus(user: AccountSubject): AccountStatus {
  if (user.id === "owner") return "APPROVED";
  const value = user.accountStatus;
  if (value === "PENDING" || value === "REJECTED" || value === "APPROVED") return value;
  return "APPROVED";
}

export function canAccessLearning(user: AccountSubject) {
  return accountStatus(user) === "APPROVED";
}

export function accountStatusLabel(status: AccountStatus) {
  return ({ PENDING: "Очікує схвалення", APPROVED: "Схвалено", REJECTED: "Відхилено" } as const)[status];
}
