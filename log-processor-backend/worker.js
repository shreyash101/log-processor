require("dotenv").config();
const { Worker } = require("bullmq");
const Redis = require("ioredis");
const supabase = require("./supabaseClient");
const fs = require("fs");
const axios = require("axios");
const path = require("path");
const readline = require("readline");

// Redis Connection
const redisConnection = new Redis(process.env.REDIS_URL, {
  maxRetriesPerRequest: null, // ✅ REQUIRED for BullMQ
});

// Worker Setup
const worker = new Worker(
  "log-processing-queue",
  async (job) => {
    const { fileId, filePath } = job.data;

    try {
      console.log(`🔄 Processing log file: ${filePath}`);

      // 🔹 1. Get the file's public URL from Supabase
      const { data } = supabase.storage
        .from("log-files")
        .getPublicUrl(filePath);

      const publicUrl = data.publicUrl;

      if (!publicUrl)
        throw new Error("Failed to retrieve file URL from Supabase");

      console.log(`📥 Downloading file from: ${publicUrl}`);

      // 🔹 2. Download the file from Supabase
      const response = await axios.get(publicUrl, { responseType: "stream" });
      
      const tempDir = path.join(__dirname, "temp_logs");
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true }); // 🔥 Creates folder if missing
      }

      const tempFilePath = path.join(
        __dirname,
        "temp_logs",
        path.basename(filePath)
      );

      const writer = fs.createWriteStream(tempFilePath);

      response.data.pipe(writer);

      await new Promise((resolve, reject) => {
        writer.on("finish", resolve);
        writer.on("error", reject);
      });

      console.log(`✅ File downloaded successfully: ${tempFilePath}`);

      // 🔹 3. Process the Log File
        const stats = await processLogFile(tempFilePath, job);

        // 🔹 4. Store processed results in Supabase `log_stats` table
        const { error: dbError } = await supabase.from("log_stats").insert([
          {
            file_id: fileId,
            file_path: filePath,
            error_count: stats.errorCount,
            keyword_counts: stats.keywordCounts,
            unique_ips: stats.uniqueIPs,
            processed_at: new Date().toISOString(),
          },
        ]);

        if (dbError) throw new Error("Failed to insert log stats into database");

        console.log(`📊 Log file processed successfully: ${filePath}`);

      //   // Cleanup: Delete temp file
        fs.unlinkSync(tempFilePath);
        console.log(`🗑️ Local file deleted: ${tempFilePath}`);

        return { ...stats, filePath}
    } catch (err) {
      console.error(`❌ Error processing log file ${filePath}:`, err.message);
      throw err; // BullMQ will retry failed jobs based on settings
    }
  },
  { connection: redisConnection, concurrency: 4 } // 4 jobs in parallel
);

// Error Handling
worker.on("failed", (job, err) => {
  console.error(`🚨 Job ${job.id} failed: ${err.message}`);
});

console.log("👷 Worker is running and listening for jobs...");

// 🔹 Function to Process Log File (Efficient Streaming)
async function processLogFile(filePath, job) {
  return new Promise((resolve, reject) => {
    let errorCount = 0;
    let keywordCounts = {};
    let uniqueIPs = new Set();
    let totalLines = 0;
    let processedLines = 0;

    const keywordList = process.env.KEYWORDS
      ? process.env.KEYWORDS.split(",")
      : [];

    // Count total lines first for accurate progress tracking
    fs.createReadStream(filePath)
      .on("data", (chunk) => {
        totalLines += chunk.toString().split("\n").length;
      })
      .on("end", () => {
        // Start processing file line-by-line
        const fileStream = fs.createReadStream(filePath);
        const rl = readline.createInterface({
          input: fileStream,
          crlfDelay: Infinity,
        });

        rl.on("line", async (line) => {
          processedLines++;

          if (line.includes("ERROR")) errorCount++;

          keywordList.forEach((keyword) => {
            if (line.includes(keyword)) {
              keywordCounts[keyword] = (keywordCounts[keyword] || 0) + 1;
            }
          });

          const ipMatch = line.match(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/);
          if (ipMatch) uniqueIPs.add(ipMatch[0]);

          // 🔥 Update job progress every 10% (or after 100 lines for small files)
          if (processedLines % Math.max(10, Math.round(totalLines / 10)) === 0) {
            const progress = Math.round((processedLines / totalLines) * 100);
            await job.updateProgress(progress);
            console.log(`📢 Job ${job.id} progress: ${progress}%`);
          }
        });

        rl.on("close", () => {
          resolve({
            errorCount,
            keywordCounts,
            uniqueIPs: Array.from(uniqueIPs),
          });
        });

        rl.on("error", reject);
      });
  });
}