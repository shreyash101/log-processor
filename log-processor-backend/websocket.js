const { Server } = require("ws");
const { QueueEvents } = require("bullmq");
const Redis = require("ioredis");
const { config } = require("dotenv");

// Initialize WebSocket server
function setupWebSocket(server) {
  const wss = new Server({ server });

  // Redis connection for BullMQ events
  const queueName = "log-processing-queue";
  const queueEvents = new QueueEvents(queueName, {
    connection: new Redis({
      maxRetriesPerRequest: null
    }), // Connect to Redis
  });

  wss.on("connection", (ws) => {
    console.log("New WebSocket client connected");

    ws.on("close", () => {
      console.log("WebSocket client disconnected");
    });
  });

  // Listen for BullMQ job events and broadcast updates
  queueEvents.on("progress", ({ jobId, data }) => {
    console.log(`Job ${jobId} is in progress: ${JSON.stringify(data)}`);
    broadcast(wss, { event: "progress", jobId, progress: `${JSON.stringify(data)}` });
  });

  queueEvents.on("completed", ({jobId, returnvalue}) => {
    broadcast(wss, { event: "progress", jobId, progress: 100 });
    console.log(`Job ${jobId} completed:`, returnvalue);
    broadcast(wss, { event: "completed", jobId, data: returnvalue });

    
  });

  function broadcast(wss, message) {
    wss.clients.forEach((client) => {
      if (client.readyState === client.OPEN) {
        client.send(JSON.stringify(message));
      }
    });
  }

  console.log("WebSocket server is running.");
}

module.exports = setupWebSocket;