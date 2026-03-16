import { Router } from "express";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import { db } from "@workspace/db";
import { usersTable, resetTokensTable } from "@workspace/db/schema";
import { eq, and, gt } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth.js";

const router = Router();

function formatUser(user: typeof usersTable.$inferSelect) {
  return {
    id: user.id,
    phoneNumber: user.phoneNumber,
    username: user.username ?? null,
    dateOfBirth: user.dateOfBirth ?? null,
    profilePictureUrl: user.profilePictureUrl ?? null,
    createdAt: user.createdAt.toISOString(),
    lastSeen: user.lastSeen?.toISOString() ?? null,
  };
}

router.post("/signup", async (req, res) => {
  const { phoneNumber, password } = req.body;

  if (!phoneNumber || !password) {
    res.status(400).json({ error: "Phone number and password are required" });
    return;
  }

  if (password.length < 6) {
    res.status(400).json({ error: "Password must be at least 6 characters" });
    return;
  }

  try {
    const existing = await db.select().from(usersTable).where(eq(usersTable.phoneNumber, phoneNumber)).limit(1);
    if (existing.length > 0) {
      res.status(409).json({ error: "Phone number already registered" });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const [user] = await db.insert(usersTable).values({
      phoneNumber,
      passwordHash,
    }).returning();

    req.session.userId = user.id;
    const profileComplete = !!(user.username && user.dateOfBirth);
    res.status(201).json({ user: formatUser(user), profileComplete });
  } catch (err) {
    console.error("Signup error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/login", async (req, res) => {
  const { phoneNumber, password } = req.body;

  if (!phoneNumber || !password) {
    res.status(400).json({ error: "Phone number and password are required" });
    return;
  }

  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.phoneNumber, phoneNumber)).limit(1);
    if (!user) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    await db.update(usersTable).set({ lastSeen: new Date() }).where(eq(usersTable.id, user.id));
    req.session.userId = user.id;

    const profileComplete = !!(user.username && user.dateOfBirth);
    res.json({ user: formatUser(user), profileComplete });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/logout", requireAuth, async (req, res) => {
  if (req.session.userId) {
    await db.update(usersTable).set({ lastSeen: new Date() }).where(eq(usersTable.id, req.session.userId)).catch(() => {});
  }
  req.session.destroy(() => {
    res.json({ message: "Logged out successfully" });
  });
});

router.get("/me", requireAuth, async (req, res) => {
  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.session.userId!)).limit(1);
    if (!user) {
      res.status(401).json({ error: "User not found" });
      return;
    }
    res.json(formatUser(user));
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/forgot-password/verify", async (req, res) => {
  const { phoneNumber, dateOfBirth } = req.body;

  if (!phoneNumber || !dateOfBirth) {
    res.status(400).json({ error: "Phone number and date of birth are required" });
    return;
  }

  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.phoneNumber, phoneNumber)).limit(1);
    if (!user || !user.dateOfBirth) {
      res.status(400).json({ error: "Verification failed" });
      return;
    }

    const storedDob = user.dateOfBirth;
    const inputDob = dateOfBirth.trim();
    if (storedDob !== inputDob) {
      res.status(400).json({ error: "Verification failed" });
      return;
    }

    const token = uuidv4();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await db.insert(resetTokensTable).values({
      userId: user.id,
      token,
      expiresAt,
    });

    res.json({ resetToken: token });
  } catch (err) {
    console.error("Verify DOB error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/forgot-password/reset", async (req, res) => {
  const { resetToken, newPassword } = req.body;

  if (!resetToken || !newPassword) {
    res.status(400).json({ error: "Reset token and new password are required" });
    return;
  }

  if (newPassword.length < 6) {
    res.status(400).json({ error: "Password must be at least 6 characters" });
    return;
  }

  try {
    const [tokenRecord] = await db.select()
      .from(resetTokensTable)
      .where(
        and(
          eq(resetTokensTable.token, resetToken),
          eq(resetTokensTable.used, false),
          gt(resetTokensTable.expiresAt, new Date())
        )
      )
      .limit(1);

    if (!tokenRecord) {
      res.status(400).json({ error: "Invalid or expired reset token" });
      return;
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await db.update(usersTable)
      .set({ passwordHash })
      .where(eq(usersTable.id, tokenRecord.userId));

    await db.update(resetTokensTable)
      .set({ used: true })
      .where(eq(resetTokensTable.id, tokenRecord.id));

    res.json({ message: "Password reset successfully" });
  } catch (err) {
    console.error("Reset password error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
