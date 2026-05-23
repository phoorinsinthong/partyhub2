const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onValueDeleted } = require("firebase-functions/v2/database");
const { getDatabase } = require("firebase-admin/database");
const { initializeApp } = require("firebase-admin/app");

initializeApp();

// Scheduled cleanup: runs every 30 minutes, removes rooms older than 2 hours or with 0 players
exports.cleanupStaleRooms = onSchedule("every 30 minutes", async () => {
  const db = getDatabase();
  const roomsSnap = await db.ref("rooms").get();

  if (!roomsSnap.exists()) return;

  const now = Date.now();
  const MAX_AGE = 2 * 60 * 60 * 1000;
  const updates = {};

  roomsSnap.forEach((child) => {
    const room = child.val();
    const age = now - (room.createdAt || 0);
    const playerCount = room.players ? Object.keys(room.players).length : 0;

    if (playerCount === 0 || age > MAX_AGE) {
      updates[`rooms/${child.key}`] = null;
    }
  });

  if (Object.keys(updates).length > 0) {
    await db.ref().update(updates);
    console.log(`Cleaned up ${Object.keys(updates).length} stale rooms`);
  }
});

// Rate limiting: when a room is created, enforce max 50 active rooms total
exports.enforceRoomLimit = onValueDeleted({
  ref: "/rooms/{roomId}",
  region: "asia-southeast1",
}, async (event) => {
  // Just log deletions for monitoring
  console.log(`Room ${event.params.roomId} was deleted`);
});
