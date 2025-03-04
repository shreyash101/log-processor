require("dotenv").config();
const express = require("express");
const multer = require("multer")
const fs = require("fs")
const logQueue = require("./queue")
const supabase = require("./supabaseClient")
const cors = require("cors")
const authenticate = require("./middleware/auth");

const statsRoutes = require("./routes/stats");
const queueStatusRoute = require("./routes/queueStatus");

const app = express();
app.use(cors({ origin: "http://localhost:3000" }));

// multer storage config (stores files temporarily before uploading to supabase)
const upload = multer({dest: "uploads/"})

// use stats route for log_stats stats
app.use(statsRoutes);

// Use the route for queue status
app.use(queueStatusRoute);

// File upload route
app.post("/api/upload-logs", authenticate, upload.single("logFile"), async (req, res) => {

    try {
        if(!req.file) return res.status(400).json({error: "No file uploaded"})
        const {originalname, path} = req.file

        const fileBuffer = fs.readFileSync(path)
        const fileName = `logs/${Date.now()}_${originalname}`

        // upload file to supabase storage
        const { data, error } = await supabase.storage.from("log-files").upload(fileName, fileBuffer)

        if(error) return res.status(500).json({error: "Failed to upload file to supabase"})

        // generate file id    
        const fileId = Date.now().toString();

        // add job to bullmq queue
        const job = await logQueue.add("process-log", {fileId: fileId, filePath: fileName})

        // cleanup: delete file from local storage after upload
        fs.unlinkSync(path)

        res.status(200).json({message: "File upload successfully", jobId: job.id})
    } catch(err) {
        console.error(err)
        res.status(500).json({error: "File upload failed"})
    }
})

// Test route
app.get("/", (req, res) => {
  res.send("Log Processor Backend is running!");
});

module.exports = app;