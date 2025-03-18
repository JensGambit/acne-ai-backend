import express from "express";
import multer from "multer";
import cors from "cors";
import * as tf from "@tensorflow/tfjs-node";
import fs from "fs/promises"; // Async file handling
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import serverless from "serverless-http";

// Get the directory name (__dirname equivalent in ES modules)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize Express app
const app = express();

// Enable CORS (Netlify functions require explicit CORS handling)
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "*", // Allow frontend to access API
    methods: ["POST"],
  })
);

// Set up multer for file uploads
const upload = multer({
  dest: "/tmp/uploads/", // Use `/tmp` for Netlify's file system
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    file.mimetype.startsWith("image/")
      ? cb(null, true)
      : cb(new Error("Invalid file type. Only images are allowed."));
  },
});

// Load TensorFlow model
const MODEL_PATH = path.join(__dirname, "..", "public", "models", "model.json");
let model;

async function loadModel() {
  try {
    console.log("⏳ Loading TensorFlow model...");
    model = await tf.loadLayersModel(`file://${MODEL_PATH}`);
    console.log("✅ Model loaded successfully!");
  } catch (err) {
    console.error("❌ Error loading model:", err.message);
    process.exit(1);
  }
}

// Preprocess image
function preprocessImage(imageBuffer) {
  return tf.tidy(() => {
    const imageTensor = tf.node.decodeImage(imageBuffer);
    return tf.image
      .resizeBilinear(imageTensor, [224, 224])
      .div(tf.scalar(255))
      .expandDims();
  });
}

// Predict function
async function predict(imageTensor) {
  const predictions = model.predict(imageTensor);
  const severityLevel = predictions.argMax(1).dataSync()[0];
  const confidence = predictions.max().dataSync()[0];

  imageTensor.dispose(); // Free memory

  return { severityLevel, confidence };
}

// Analyze image endpoint (Serverless function)
app.post("/analyze", upload.single("image"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No image file uploaded." });
  }

  const imagePath = req.file.path;

  try {
    const imageBuffer = await fs.readFile(imagePath);
    const imageTensor = preprocessImage(imageBuffer);
    const { severityLevel, confidence } = await predict(imageTensor);

    await fs.unlink(imagePath); // Cleanup file

    res.json({ severityLevel, confidence, message: "Analysis complete!" });
  } catch (err) {
    console.error("❌ Error analyzing image:", err);
    if (fs.existsSync(imagePath)) await fs.unlink(imagePath);
    res.status(500).json({ error: "Failed to analyze image." });
  }
});

// Health check
app.get("/health", (req, res) => {
  res.status(200).json({ status: "OK", message: "Server is running." });
});

// Export the serverless function
export const handler = serverless(app);
