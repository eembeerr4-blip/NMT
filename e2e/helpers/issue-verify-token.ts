import { newSecret, secretHash } from "../../src/lib/account-auth";
import { e2eDb } from "./e2e-db";

const VERIFY_TTL_MS = 24 * 60 * 60 * 1000;

/** E2E-only: issue a fresh VERIFY_EMAIL token (real mail is not read in CI). */
export async function issueVerifyEmailToken(nickname: string) {
  const user = await e2eDb().user.findUnique({ where: { nickname } });
  if (!user) throw new Error(`e2e user not found: ${nickname}`);
  const token = newSecret();
  await e2eDb().authToken.deleteMany({
    where: { userId: user.id, purpose: "VERIFY_EMAIL", consumedAt: null },
  });
  await e2eDb().authToken.create({
    data: {
      userId: user.id,
      purpose: "VERIFY_EMAIL",
      tokenHash: secretHash(token),
      expiresAt: new Date(Date.now() + VERIFY_TTL_MS),
    },
  });
  return token;
}
