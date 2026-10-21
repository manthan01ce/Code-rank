import test, { mock } from "node:test";
import assert from "node:assert/strict";
process.env.JWT_SECRET = "user-api-test-secret";
let observed;
mock.module(
  new URL("../packages/core/src/db/client.js", import.meta.url).href,
  {
    defaultExport: {
      query: async (q, p) => {
        observed = { q, p };
        return [{ u: { id: 2, role: "student", name: "Test" } }];
      },
    },
  },
);
const { UserManagementService: service } = await import(
  "../packages/core/src/modules/users/UserManagementService.js"
);
test("user management validates roles, passwords, IDs and normalizes bounded payloads", async () => {
  const admin = { id: 1, role: "admin" };
  await assert.rejects(
    service.mutate({ id: 2, role: "student" }, 2, "deactivate"),
    (e) => e.status === 401,
  );
  for (const payload of [
    { role: "admin" },
    { email: "bad" },
    { status: "deleted" },
    { password: "short" },
    { extra_info: [] },
  ])
    await assert.rejects(
      service.mutate(admin, 2, "update", payload),
      (e) => e.status === 400,
    );
  await assert.rejects(
    service.mutate(admin, "2junk", "deactivate"),
    (e) => e.status === 400,
  );
  await assert.rejects(
    service.mutate(admin, null, "create", {
      name: "Test",
      email: "t@test.io",
      role: "student",
    }),
    (e) => e.status === 400,
  );
  const result = await service.mutate(admin, null, "create", {
    name: "Test",
    email: "T@TEST.IO",
    role: "student",
    extra_info: { division: "ce1" },
  });
  const payload = JSON.parse(observed.p[3]);
  assert.equal(payload.email, "t@test.io");
  assert.equal(payload.extra_info.division, "CE1");
  assert.match(payload.password_hash, /^\$2/);
  assert.equal(result.user.password_hash, undefined);
  assert.ok(result.rawPassword);
});
