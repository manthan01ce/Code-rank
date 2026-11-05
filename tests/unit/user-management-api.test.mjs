import test, { mock } from "node:test";
import assert from "node:assert/strict";
process.env.JWT_SECRET = "user-api-test-secret";
let observed;
const dbMock = {
  query: async (q, p) => {
    observed = { q, p };
    return [{ u: { id: 2, role: "student", name: "Test" } }];
  },
};
mock.module(
  new URL("../../packages/core/src/db/client.js", import.meta.url).href,
  {
    defaultExport: dbMock,
  },
);
const { UserManagementService: service } = await import(
  "../../apps/api/src/modules/users/user-management.service.js"
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
  assert.equal(result.user.id, 2);
  assert.equal(typeof result.rawPassword, "string");
  assert.equal(observed.p[1], null);
  assert.equal(observed.p[2], "create");
  assert.equal(JSON.parse(observed.p[3]).email, "t@test.io");
  assert.equal(JSON.parse(observed.p[3]).extra_info.division, "CE1");
  const timings = [];
  await service.mutate(admin, 2, "deactivate", {}, { onTiming: (step, ms) => timings.push({ step, ok: ms >= 0 }) });
  assert.deepEqual(timings.map(t => t.step), ['validation', 'password_hash', 'database_commit']);
  assert.ok(timings.every(t => t.ok));
});
