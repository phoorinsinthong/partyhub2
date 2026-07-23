const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();

// Run every hour to clean up dead rooms
exports.cleanupDeadRooms = functions.pubsub.schedule("every 1 hours").onRun(async (context) => {
  const db = admin.database();
  const roomsRef = db.ref("rooms");
  
  const snapshot = await roomsRef.once("value");
  const rooms = snapshot.val();
  
  if (!rooms) return null;

  const now = Date.now();
  const ONE_HOUR = 3600000;
  const updates = {};
  
  for (const [roomId, roomData] of Object.entries(rooms)) {
    let isActive = false;
    
    // Check if any player has been active in the last hour
    if (roomData.players) {
      for (const player of Object.values(roomData.players)) {
        if (player.lastActive && (now - player.lastActive < ONE_HOUR)) {
          isActive = true;
          break;
        }
      }
    }
    
    // If no one has been active, mark room for deletion
    if (!isActive) {
      console.log(`Deleting inactive room: ${roomId}`);
      updates[roomId] = null;
    }
  }

  // Batch delete
  if (Object.keys(updates).length > 0) {
    await roomsRef.update(updates);
    console.log(`Cleaned up ${Object.keys(updates).length} rooms.`);
  } else {
    console.log("No inactive rooms found.");
  }
  
  return null;
});
