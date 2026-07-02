// Migration: owner (seller) account
// Seeds the platform owner's login — the person who sells/hosts the app.
// The owner can manage the client's admin credentials and set account limits.
// user_id 9995 avoids the other reserved ids (9996 admin, 9997 security,
// 9998/9999 depot). Idempotent.

export const up = async (db) => {
  const owner = await db.get("SELECT user_id FROM users WHERE role = 'owner'");
  if (!owner) {
    await db.run(
      "INSERT INTO users (user_id, username, password, role) VALUES (9995, 'superadmin', 'superadmin123', 'owner')"
    );
  }
};

export const down = async (db) => {
  await db.run("DELETE FROM users WHERE user_id = 9995 AND role = 'owner'");
};
