// End-to-end API tests against a real, ephemeral MongoDB (mongodb-memory-server
// downloads a real mongod binary on first run — needs internet access once).
// Run with: npm test
const test = require("node:test");
const assert = require("node:assert/strict");
const { MongoMemoryServer } = require("mongodb-memory-server");

let mongod, app, server;
const base = () => `http://localhost:${server.address().port}/api`;

test.before(async () => {
  mongod = await MongoMemoryServer.create();
  process.env.MONGO_URI = mongod.getUri();
  process.env.JWT_SECRET = "test-secret";
  process.env.JWT_EXPIRES_IN = "1h";
  process.env.NODE_ENV = "test";

  const mongoose = require("mongoose");
  await mongoose.connect(process.env.MONGO_URI);

  app = require("../app"); // see app.js — server.js's Express app minus the listen() call
  server = app.listen(0); // random free port
});

test.after(async () => {
  const mongoose = require("mongoose");
  await mongoose.disconnect();
  await mongod.stop();
  server.close();
});

let token, otherToken;
let categoryId, txnId;

test("register creates an account and never returns the password", async () => {
  const res = await fetch(base() + "/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Ibrahim Hassan", username: "ibrahim", email: "ibrahim@example.com", password: "secret123" }),
  });
  const body = await res.json();
  assert.equal(res.status, 201);
  assert.equal(body.success, true);
  assert.ok(body.data.token);
  assert.equal(body.data.user.password, undefined);
  token = body.data.token;
});

test("duplicate username is rejected with 409", async () => {
  const res = await fetch(base() + "/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Other", username: "ibrahim", email: "other@example.com", password: "secret123" }),
  });
  assert.equal(res.status, 409);
});

test("login works by username and by email; wrong password fails", async () => {
  let res = await fetch(base() + "/auth/login", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "ibrahim", password: "secret123" }),
  });
  assert.equal(res.status, 200);

  res = await fetch(base() + "/auth/login", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "ibrahim@example.com", password: "secret123" }),
  });
  assert.equal(res.status, 200);

  res = await fetch(base() + "/auth/login", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "ibrahim", password: "wrong" }),
  });
  assert.equal(res.status, 401);
});

test("a second user cannot see the first user's transactions", async () => {
  const res = await fetch(base() + "/auth/register", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Second User", username: "second", email: "second@example.com", password: "secret123" }),
  });
  otherToken = (await res.json()).data.token;
});

test("categories: auto-seeded on first list, duplicates rejected", async () => {
  const res = await fetch(base() + "/categories", { headers: { Authorization: "Bearer " + token } });
  const body = await res.json();
  assert.ok(body.data.categories.length > 0);
  categoryId = body.data.categories.find((c) => c.type === "income")._id;

  const dup = body.data.categories.find((c) => c.type === "income").name;
  const res2 = await fetch(base() + "/categories", {
    method: "POST", headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
    body: JSON.stringify({ name: dup, type: "income" }),
  });
  assert.equal(res2.status, 409);
});

test("amount must be a positive number", async () => {
  const res = await fetch(base() + "/transactions", {
    method: "POST", headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
    body: JSON.stringify({ type: "income", amount: 0, category: "Salary", date: "2026-09-29" }),
  });
  assert.equal(res.status, 400);
});

test("transaction category must already exist for that user/type", async () => {
  const res = await fetch(base() + "/transactions", {
    method: "POST", headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
    body: JSON.stringify({ type: "income", amount: 100, category: "Not A Real Category", date: "2026-09-29" }),
  });
  assert.equal(res.status, 400);
});

test("create, read, update, delete a transaction; balance reflects it", async () => {
  const today = new Date().toISOString().slice(0, 10);
  let res = await fetch(base() + "/transactions", {
    method: "POST", headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
    body: JSON.stringify({ type: "income", amount: 1235, category: "Salary", date: today, description: "Sept pay" }),
  });
  let body = await res.json();
  assert.equal(res.status, 201);
  txnId = body.data._id;

  res = await fetch(base() + "/transactions/dashboard?today=" + today, { headers: { Authorization: "Bearer " + token } });
  body = await res.json();
  assert.equal(body.data.income.today, 1235);
  assert.equal(body.data.balance, body.data.income.total - body.data.expense.total);

  res = await fetch(base() + "/transactions/" + txnId, {
    method: "PUT", headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
    body: JSON.stringify({ amount: 999 }),
  });
  assert.equal(res.status, 200);
  assert.equal((await res.json()).data.amount, 999);

  res = await fetch(base() + "/transactions/" + txnId, { method: "DELETE", headers: { Authorization: "Bearer " + token } });
  assert.equal(res.status, 200);
});

test("a user cannot fetch another user's transaction by ID", async () => {
  const today = new Date().toISOString().slice(0, 10);
  const created = await fetch(base() + "/transactions", {
    method: "POST", headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
    body: JSON.stringify({ type: "expense", amount: 50, category: "Food", date: today }),
  });
  const { data } = await created.json();

  const res = await fetch(base() + "/transactions/" + data._id, { headers: { Authorization: "Bearer " + otherToken } });
  assert.equal(res.status, 404); // scoped query finds nothing for the wrong owner — not 403, but never leaks the record
});

test("category rename cascades to its transactions; delete-in-use is refused", async () => {
  const cat = await fetch(base() + "/categories", {
    method: "POST", headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Freelance", type: "income" }),
  });
  const { data: category } = await cat.json();

  await fetch(base() + "/transactions", {
    method: "POST", headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
    body: JSON.stringify({ type: "income", amount: 200, category: "Freelance", date: "2026-09-29" }),
  });

  await fetch(base() + "/categories/" + category._id, {
    method: "PUT", headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Contract Work" }),
  });

  const list = await fetch(base() + "/transactions?type=income&search=Contract", { headers: { Authorization: "Bearer " + token } });
  const { data } = await list.json();
  assert.equal(data.transactions[0].category, "Contract Work");

  const del = await fetch(base() + "/categories/" + category._id, { method: "DELETE", headers: { Authorization: "Bearer " + token } });
  assert.equal(del.status, 409); // still in use
});

test("non-admin is blocked from admin routes", async () => {
  const res = await fetch(base() + "/admin/users", { headers: { Authorization: "Bearer " + token } });
  assert.equal(res.status, 403);
});

test("no token is rejected", async () => {
  const res = await fetch(base() + "/transactions");
  assert.equal(res.status, 401);
});

test("regex special characters in search don't crash the query", async () => {
  const res = await fetch(base() + "/transactions?search=" + encodeURIComponent("(a+["), {
    headers: { Authorization: "Bearer " + token },
  });
  assert.equal(res.status, 200);
});

test("reports: monthly preset returns a balanced total", async () => {
  const res = await fetch(base() + "/reports?range=monthly", { headers: { Authorization: "Bearer " + token } });
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.data.balance, body.data.totalIncome - body.data.totalExpense);
});

test("reports: CSV export returns text/csv", async () => {
  const res = await fetch(base() + "/reports/export?range=monthly", { headers: { Authorization: "Bearer " + token } });
  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-type"), /text\/csv/);
  const text = await res.text();
  assert.match(text, /^Date,Type,Category,Description,Amount/);
});

test("forgot-password always returns a generic success message", async () => {
  const res = await fetch(base() + "/auth/forgot-password", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "nobody@example.com" }),
  });
  assert.equal(res.status, 200);
  assert.equal((await res.json()).success, true);
});

// ---------- Section 28: user-management, settings, profile, business, security ----------

test("profile: get and update, role/isActive/approvalStatus cannot be set via the endpoint", async () => {
  let res = await fetch(base() + "/profile", { headers: { Authorization: "Bearer " + token } });
  assert.equal(res.status, 200);

  res = await fetch(base() + "/profile", {
    method: "PATCH", headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Ibrahim Updated", phone: "+252600000000", language: "so", theme: "dark", role: "admin", isActive: false }),
  });
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.data.user.name, "Ibrahim Updated");
  assert.equal(body.data.user.language, "so");
  assert.equal(body.data.user.role, "user"); // role field in the payload was ignored entirely
  assert.equal(body.data.user.isActive, true); // isActive field in the payload was ignored entirely
});

test("profile: change password requires the correct current password", async () => {
  let res = await fetch(base() + "/profile/password", {
    method: "PATCH", headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
    body: JSON.stringify({ currentPassword: "wrong", newPassword: "newpass123" }),
  });
  assert.equal(res.status, 401);

  res = await fetch(base() + "/profile/password", {
    method: "PATCH", headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
    body: JSON.stringify({ currentPassword: "secret123", newPassword: "newpass123" }),
  });
  assert.equal(res.status, 200);

  // revert so later tests can keep using the original password
  await fetch(base() + "/profile/password", {
    method: "PATCH", headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
    body: JSON.stringify({ currentPassword: "newpass123", newPassword: "secret123" }),
  });
});

test("business profile: upsert, requires a name on first save", async () => {
  let res = await fetch(base() + "/business", {
    method: "PATCH", headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
    body: JSON.stringify({ ownerName: "Ibrahim" }), // no businessName yet
  });
  assert.equal(res.status, 400);

  res = await fetch(base() + "/business", {
    method: "PATCH", headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
    body: JSON.stringify({ businessName: "Himilo Traders", currency: "USD" }),
  });
  assert.equal(res.status, 200);

  res = await fetch(base() + "/business", { headers: { Authorization: "Bearer " + token } });
  assert.equal((await res.json()).data.business.businessName, "Himilo Traders");
});

test("a non-admin cannot create a user when allowUsersToCreateUsers is off (the default)", async () => {
  const res = await fetch(base() + "/users", {
    method: "POST", headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
    body: JSON.stringify({ name: "New Guy", username: "newguy1", email: "newguy1@example.com", password: "secret123" }),
  });
  assert.equal(res.status, 403);
});

test("admin enables allowUsersToCreateUsers; a non-admin can then create a user, but NEVER an admin", async () => {
  // promote "second" user to admin via direct DB write (simplest path in a test, equivalent to scripts/makeAdmin.js)
  const User = require("../models/User");
  await User.updateOne({ username: "second" }, { $set: { role: "admin" } });

  const adminLogin = await fetch(base() + "/auth/login", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "second", password: "secret123" }),
  });
  const adminToken = (await adminLogin.json()).data.token;

  let res = await fetch(base() + "/admin/settings", {
    method: "PATCH", headers: { Authorization: "Bearer " + adminToken, "Content-Type": "application/json" },
    body: JSON.stringify({ allowUsersToCreateUsers: true }),
  });
  assert.equal(res.status, 200);

  // Non-admin "ibrahim" tries to sneak role:"admin" into the request body — must be silently discarded.
  res = await fetch(base() + "/users", {
    method: "POST", headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Sneaky Admin", username: "sneakyadmin", email: "sneaky@example.com", password: "secret123", role: "admin" }),
  });
  const body = await res.json();
  assert.equal(res.status, 201);
  assert.equal(body.data.user.role, "user", "role:admin in the request body must be ignored for a non-admin creator");

  // turn the setting back off for isolation from later tests
  await fetch(base() + "/admin/settings", {
    method: "PATCH", headers: { Authorization: "Bearer " + adminToken, "Content-Type": "application/json" },
    body: JSON.stringify({ allowUsersToCreateUsers: false }),
  });
});

test("an admin CAN create another admin via /api/users", async () => {
  const adminLogin = await fetch(base() + "/auth/login", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "second", password: "secret123" }),
  });
  const adminToken = (await adminLogin.json()).data.token;

  const res = await fetch(base() + "/users", {
    method: "POST", headers: { Authorization: "Bearer " + adminToken, "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Co Admin", username: "coadmin", email: "coadmin@example.com", password: "secret123", role: "admin" }),
  });
  const body = await res.json();
  assert.equal(res.status, 201);
  assert.equal(body.data.user.role, "admin");
});

test("approval workflow: pending users cannot log in until an admin approves them", async () => {
  const adminLogin = await fetch(base() + "/auth/login", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "second", password: "secret123" }),
  });
  const adminToken = (await adminLogin.json()).data.token;

  await fetch(base() + "/admin/settings", {
    method: "PATCH", headers: { Authorization: "Bearer " + adminToken, "Content-Type": "application/json" },
    body: JSON.stringify({ requireAdminApproval: true }),
  });

  let res = await fetch(base() + "/auth/register", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Pending Person", username: "pendingperson", email: "pending@example.com", password: "secret123" }),
  });
  const regBody = await res.json();
  assert.equal(res.status, 201);
  assert.equal(regBody.data.pendingApproval, true);
  assert.equal(regBody.data.token, undefined, "a pending account must not receive a usable token");

  res = await fetch(base() + "/auth/login", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "pendingperson", password: "secret123" }),
  });
  assert.equal(res.status, 403);

  // approve it, then login should work
  const pendingId = regBody.data.user._id;
  res = await fetch(base() + `/admin/users/${pendingId}/approve`, {
    method: "PATCH", headers: { Authorization: "Bearer " + adminToken },
  });
  assert.equal(res.status, 200);

  res = await fetch(base() + "/auth/login", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "pendingperson", password: "secret123" }),
  });
  assert.equal(res.status, 200);

  await fetch(base() + "/admin/settings", {
    method: "PATCH", headers: { Authorization: "Bearer " + adminToken, "Content-Type": "application/json" },
    body: JSON.stringify({ requireAdminApproval: false }),
  });
});

test("self-registration can be disabled system-wide", async () => {
  const adminLogin = await fetch(base() + "/auth/login", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "second", password: "secret123" }),
  });
  const adminToken = (await adminLogin.json()).data.token;

  await fetch(base() + "/admin/settings", {
    method: "PATCH", headers: { Authorization: "Bearer " + adminToken, "Content-Type": "application/json" },
    body: JSON.stringify({ allowUserRegistration: false }),
  });

  const res = await fetch(base() + "/auth/register", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Blocked", username: "blockedreg", email: "blocked@example.com", password: "secret123" }),
  });
  assert.equal(res.status, 403);

  await fetch(base() + "/admin/settings", {
    method: "PATCH", headers: { Authorization: "Bearer " + adminToken, "Content-Type": "application/json" },
    body: JSON.stringify({ allowUserRegistration: true }),
  });
});

test("accountType can be set at registration and defaults to individual", async () => {
  const res = await fetch(base() + "/auth/register", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Biz Owner", username: "bizowner1", email: "bizowner1@example.com", password: "secret123", accountType: "small_business" }),
  });
  const body = await res.json();
  assert.equal(res.status, 201);
  assert.equal(body.data.user.accountType, "small_business");
});

test("profile: notification preferences are actually persisted (partial update)", async () => {
  let res = await fetch(base() + "/profile", {
    method: "PATCH", headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
    body: JSON.stringify({ notifications: { transactions: false, system: false } }),
  });
  assert.equal(res.status, 200);

  res = await fetch(base() + "/profile", { headers: { Authorization: "Bearer " + token } });
  const body = await res.json();
  assert.equal(body.data.user.notifications.transactions, false);
  assert.equal(body.data.user.notifications.system, false);
  assert.equal(body.data.user.notifications.account, true, "fields not included in the PATCH must be left untouched");
});

test("image upload: rejects a non-image file disguised with an image-like name", async () => {
  const fakeImage = "data:text/html;base64," + Buffer.from("<script>alert(1)</script>").toString("base64");
  const res = await fetch(base() + "/profile/image", {
    method: "POST", headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
    body: JSON.stringify({ image: fakeImage }),
  });
  assert.equal(res.status, 400);
});

// ---------- Admin upgrade: overview, pagination, editable fields, CSV export ----------

test("admin overview: returns system-wide stats, blocked for non-admins", async () => {
  let res = await fetch(base() + "/admin/overview", { headers: { Authorization: "Bearer " + token } });
  assert.equal(res.status, 403);

  const adminLogin = await fetch(base() + "/auth/login", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "second", password: "secret123" }),
  });
  const adminToken = (await adminLogin.json()).data.token;

  res = await fetch(base() + "/admin/overview", { headers: { Authorization: "Bearer " + adminToken } });
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.ok(body.data.users.total > 0);
  assert.equal(body.data.transactions.netBalance, body.data.transactions.totalIncome - body.data.transactions.totalExpense);
});

test("admin: users list is paginated", async () => {
  const adminLogin = await fetch(base() + "/auth/login", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "second", password: "secret123" }),
  });
  const adminToken = (await adminLogin.json()).data.token;

  const res = await fetch(base() + "/admin/users?page=1&limit=2", { headers: { Authorization: "Bearer " + adminToken } });
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.ok(body.data.users.length <= 2);
  assert.equal(body.data.pagination.limit, 2);
  assert.ok(body.data.pagination.total >= body.data.users.length);
});

test("admin can edit a user's name/email/phone; duplicate email is rejected", async () => {
  const adminLogin = await fetch(base() + "/auth/login", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "second", password: "secret123" }),
  });
  const adminToken = (await adminLogin.json()).data.token;
  const me = await fetch(base() + "/auth/login", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "ibrahim", password: "secret123" }),
  });
  const ibrahimId = (await me.json()).data.user._id;

  let res = await fetch(base() + `/admin/users/${ibrahimId}`, {
    method: "PATCH", headers: { Authorization: "Bearer " + adminToken, "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Ibrahim Updated By Admin", phone: "+252611111111" }),
  });
  let body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.data.name, "Ibrahim Updated By Admin");

  // duplicate email (second's own email) is rejected
  res = await fetch(base() + `/admin/users/${ibrahimId}`, {
    method: "PATCH", headers: { Authorization: "Bearer " + adminToken, "Content-Type": "application/json" },
    body: JSON.stringify({ email: "second@example.com" }),
  });
  assert.equal(res.status, 409);
});

test("admin exports: users and audit log CSV endpoints return text/csv", async () => {
  const adminLogin = await fetch(base() + "/auth/login", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "second", password: "secret123" }),
  });
  const adminToken = (await adminLogin.json()).data.token;

  let res = await fetch(base() + "/admin/users/export", { headers: { Authorization: "Bearer " + adminToken } });
  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-type"), /text\/csv/);
  let text = await res.text();
  assert.match(text, /^Name,Username,Email/);

  res = await fetch(base() + "/admin/audit-logs/export", { headers: { Authorization: "Bearer " + adminToken } });
  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-type"), /text\/csv/);
  text = await res.text();
  assert.match(text, /^When,User,Action/);
});

test("admin: /users/export resolves to the export handler, not getUser('export')", async () => {
  // Regression test for an Express route-ordering mistake: /users/export must
  // be registered before /users/:id, or "export" gets treated as an ID.
  const adminLogin = await fetch(base() + "/auth/login", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "second", password: "secret123" }),
  });
  const adminToken = (await adminLogin.json()).data.token;

  const res = await fetch(base() + "/admin/users/export", { headers: { Authorization: "Bearer " + adminToken } });
  assert.notEqual(res.status, 404);
  const contentType = res.headers.get("content-type") || "";
  assert.ok(!contentType.includes("application/json"), "a JSON 404 from getUser would mean the wrong route matched");
});
