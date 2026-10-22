import test, { mock } from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
process.env.JWT_SECRET = "bulk-api-test-secret";
registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith("@/"))
      return next(
        new URL(`../apps/web/src/${specifier.slice(2)}.js`, import.meta.url)
          .href,
        context,
      );
    if (specifier === "next/server") return next("next/server.js", context);
    return next(specifier, context);
  },
});
const created = [];
mock.module("@coderank/core/services/UserManagementService", {
  namedExports: {
    UserManagementService: {
      mutate: async (_admin, _id, _action, body) => {
        if (body.email === "existing@test.io") throw { status: 409 };
        if (body.email === "fail@test.io") throw Error("private SQL details");
        created.push(body);
        return { user: { id: 1, ...body }, rawPassword: "test-only" };
      },
    },
  },
});
const { generateToken, getUserFromRequest } = await import("../packages/core/src/utils/auth.js");
mock.module('@coderank/core/security/active-actor', { namedExports: {
  authenticateRequest: async (request, { optional = false } = {}) => {
    const header = request?.headers?.get?.('authorization');
    if (optional && !header) return null;
    const actor = header && getUserFromRequest(request);
    if (!actor) throw { status: 401, message: 'Authentication required' };
    return actor;
  },
} });

const { POST } = await import("../apps/web/src/app/api/users/bulk/route.js");
function request(
  content,
  role = "student",
  actor = "admin",
  name = "users.csv",
) {
  const form = new FormData();
  form.set("role", role);
  form.set("file", new File([content], name));
  return new Request("http://localhost/api/users/bulk", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${generateToken({ id: 1, role: actor })}`,
    },
    body: form,
  });
}
test("bulk CSV validates roles/limits and reports only committed rows without leaking DB errors", async () => {
  assert.equal(
    (await POST(request("Name,Email\nName,n@test.io", "student", "faculty")))
      .status,
    401,
  );
  assert.equal(
    (await POST(request("Name,Email\nName,n@test.io", "admin"))).status,
    400,
  );
  assert.equal(
    (await POST(request("bad data", "student", "admin", "bad.xlsx"))).status,
    400,
  );
  const csv =
    "Name,,Email,Division\nFresh,,fresh@test.io,ce1\nDuplicate,,existing@test.io,CE1\nFail,,fail@test.io,CE1\nInvalid,,wrong,CE1";
  const response = await POST(request(csv));
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.created.length, 1);
  assert.equal(result.skipped.length, 2);
  assert.equal(result.errors.length, 1);
  assert.equal(created[0].email, "fresh@test.io");
  assert.ok(!JSON.stringify(result).includes("private SQL"));
  assert.equal(
    (
      await POST(
        request(
          "Name,Email,Division\n" +
            Array.from({ length: 501 }, (_, i) => `S,s${i}@test.io,CE1`).join(
              "\n",
            ),
        ),
      )
    ).status,
    400,
  );
  assert.equal(created.length, 1);
});
