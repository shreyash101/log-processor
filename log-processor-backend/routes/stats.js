const express = require("express");
const supabase = require("../supabaseClient");

const router = express.Router();

router.get("/api/stats", async (req, res) => {
  const { data, error } = await supabase
    .from("log_stats")
    .select("error_count, keyword_counts, unique_ips");

  console.log(data);

  if (error) return res.status(500).json({ error: error.message });

  // Aggregate stats
  let totalErrors = 0;
  let keywordCounts = {};
  let uniqueIPs = new Set();

  data.forEach((entry) => {
    totalErrors += entry.error_count;
    uniqueIPs.add(entry.unique_ips);

    // Merge keyword_counts JSON objects
    Object.entries(entry.keyword_counts).forEach(([keyword, count]) => {
      keywordCounts[keyword] = (keywordCounts[keyword] || 0) + count;
    });
  });

  res.json({
    totalErrors,
    topKeywords: Object.entries(keywordCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5) // Top 5 keywords
      .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {}), // Convert back to object
    uniqueIPCount: uniqueIPs.size,
  });
});

router.get("/api/stats/:jobId", async (req, res) => {
  const { jobId } = req.params;

  const { data, error } = await supabase
    .from("log_stats")
    .select(
      "file_id, file_path, error_count, keyword_counts, unique_ips, processed_at"
    )
    .eq("file_id", jobId)
    .single(); // Ensure only one result

  if (error) return res.status(500).json({ error: error.message });

  if (!data) return res.status(404).json({ error: "Job not found" });

  res.json(data);
});

module.exports = router;
