const express = require("express");
const router = express.Router();
const logQueue = require("../queue");  // Import logQueue from queue.js

// Route to get the queue status
router.get("/api/queue-status", async (req, res) => {
  try {
    // Get queue status
    const [completed, waiting, active] = await Promise.all([
      logQueue.getCompletedCount(),
      logQueue.getWaitingCount(),
      logQueue.getActiveCount(),
    ]);

    // Return queue status
    res.json({
      completed,
      waiting,
      active
    });
  } catch (error) {
    console.error("Error fetching queue status:", error);
    res.status(500).json({ error: "Failed to fetch queue status" });
  }
});

module.exports = router;
