const http = require("http");
const app = require("./app"); // Import Express app
const setupWebSocket = require("./websocket"); // Import WebSocket logic

const PORT = process.env.PORT || 4000;

// Create HTTP server and attach Express app
const server = http.createServer(app);

// Setup WebSocket server
setupWebSocket(server);

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

// async function getJobs() {
//     const jobs = await logQueue.obliterate({ force: true });
//     console.log(jobs);
//   }
//   getJobs();