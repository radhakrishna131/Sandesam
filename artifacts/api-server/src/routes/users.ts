import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq, ilike } from "drizzle-orm";
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

router.put("/profile", requireAuth, async (req, res) => {
  const { username, dateOfBirth, profilePictureUrl } = req.body;

  try {
    const updates: Partial<typeof usersTable.$inferInsert> = {};
    if (username !== undefined) updates.username = username;
    if (dateOfBirth !== undefined) updates.dateOfBirth = dateOfBirth;
    if (profilePictureUrl !== undefined) updates.profilePictureUrl = profilePictureUrl;

    const [user] = await db.update(usersTable)
      .set(updates)
      .where(eq(usersTable.id, req.session.userId!))
      .returning();

    res.json(formatUser(user));
  } catch (err) {
    console.error("Update profile error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/search", requireAuth, async (req, res) => {
  const phone = req.query.phone as string;

  if (!phone) {
    res.status(400).json({ error: "Phone number required" });
    return;
  }

  try {
    const results = await db.select()
      .from(usersTable)
      .where(ilike(usersTable.phoneNumber, `%${phone}%`))
      .limit(20);

    const users = results
      .filter(u => u.id !== req.session.userId)
      .map(formatUser);

    res.json({ users });
  } catch (err) {
    console.error("Search users error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:userId", requireAuth, async (req, res) => {
  const userId = parseInt(req.params.userId);

  if (isNaN(userId)) {
    res.status(400).json({ error: "Invalid user ID" });
    return;
  }

  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    res.json(formatUser(user));
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
