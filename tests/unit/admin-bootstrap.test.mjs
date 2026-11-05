import test, { mock } from "node:test";
import assert from "node:assert/strict";
process.env.JWT_SECRET = "bootstrap-test-secret";
process.env.ADMIN_EMAIL = "bootstrap@test.io";
process.env.ADMIN_PASSWORD = "bootstrap-test-password";
let user = null,
  offline = false,
  sessionFailure = false;
const sql = Object.assign(
  async (strings, ...values) => {
    if (offline) throw Object.assign(Error("offline"), { code: "OFFLINE" });
    const text = strings.join("");
    if (text.includes("SELECT * FROM users")) return user ? [user] : [];
    if (text.includes("INSERT INTO users")) {
      user = {
        id: 42,
        name: "Super Admin",
        email: values[0],
        password: values[1],
        role: "admin",
        status: "active",
      };
      return [user];
    }
    return [];
  },
  {
    query: async () => {
      if (sessionFailure) throw Error("session transaction failed");
      return [{ user_id: 42 }];
    },
  },
);

sql.readQuery = async () => {
  if (offline) throw Error('offline');
  return user ? [user] : [];
};
const { verifyToken } = await import("../../packages/core/src/utils/auth.js");
mock.module('@coderank/database', { defaultExport: sql, namedExports: { closeDatabase: async () => {} } });
const { AuthService } = await import('../../apps/api/src/modules/auth/auth.service.js');
test("configured admin bootstraps a persistent identity and never logs in without a committed session", async () => {
  const result = await AuthService.login({
    email: process.env.ADMIN_EMAIL,
    password: process.env.ADMIN_PASSWORD,
  });
  assert.equal(result.user.id, 42);
  assert.equal(verifyToken(result.token).id, 42);
  assert.notEqual(user.password, process.env.ADMIN_PASSWORD);
  sessionFailure = true;
  await assert.rejects(
    AuthService.login({
      email: process.env.ADMIN_EMAIL,
      password: process.env.ADMIN_PASSWORD,
    }),
    /session transaction failed/,
  );
  sessionFailure = false;
  offline = true;
  await assert.rejects(
    AuthService.login({
      email: process.env.ADMIN_EMAIL,
      password: process.env.ADMIN_PASSWORD,
    }),
    (e) => e.status === 503,
  );
  offline = false;
  user.status = "inactive";
  await assert.rejects(
    AuthService.login({
      email: process.env.ADMIN_EMAIL,
      password: process.env.ADMIN_PASSWORD,
    }),
    (e) => e.status === 403,
  );
});
