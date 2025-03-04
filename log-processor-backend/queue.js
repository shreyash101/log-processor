const { Queue } = require("bullmq");
const Redis = require("ioredis");

const redisConnection = new Redis(process.env.REDIS_URL);
const logQueue = new Queue("log-processing-queue", { connection: redisConnection });
module.exports = logQueue;