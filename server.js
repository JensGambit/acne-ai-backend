import express from "express";
import cors from "cors";
import multer from "multer";
import path from "path";
import fs from "fs";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import * as tf from "@tensorflow/tfjs-node";

// Load environment variables
dotenv.config();

// Fix __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// Ensure environment variables exist
const BACKEND_URL = process.env.BACKEND_URL || `https://acne-ai-backend-2nmn.onrender.com`;
const FRONTEND_URL = process.env.FRONTEND_URL || "https://acneseverityai.netlify.app";
console.log(`\uD83C\uDF0D BACKEND_URL: ${BACKEND_URL}`);
console.log(`\uD83C\uDF0D FRONTEND_URL: ${FRONTEND_URL}`);

// Ensure 'uploads/' directory exists
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Middleware Setup
app.use(cors({
    origin: (origin, callback) => {
        const allowedOrigins = [FRONTEND_URL, "http://localhost:5173"];
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error("CORS not allowed"));
        }
    },
    credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Multer Storage
const storage = multer.memoryStorage();
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } }); // 5MB Limit

// Load TensorFlow Model
let model;
const loadModel = async () => {
    try {
        console.log("⏳ Loading TensorFlow model...");
        const modelPath = path.join(__dirname, "public", "models", "model.json");

        if (!fs.existsSync(modelPath)) {
            console.error("❌ Model file not found at:", modelPath);
            return;
        }

        model = await tf.loadLayersModel(`file://${modelPath}`);

        // Pre-warm the model
        const dummyInput = tf.zeros([1, 224, 224, 3]);
        model.predict(dummyInput);
        dummyInput.dispose();

        console.log("✅ Model loaded successfully!");
    } catch (error) {
        console.error("❌ Error loading model:", error);
    }
};

// Ensure model is loaded before accepting requests
await loadModel();

// Image Upload Endpoint
app.post("/upload", upload.single("image"), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: "No image uploaded." });
        }

        const filePath = path.join(uploadDir, `${Date.now()}-${req.file.originalname}`);
        await fs.promises.writeFile(filePath, req.file.buffer);

        res.status(200).json({
            message: "✅ Image uploaded successfully!",
            path: `${BACKEND_URL}/uploads/${path.basename(filePath)}`,
        });
    } catch (error) {
        console.error("❌ Image Upload Error:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// Image Analysis Endpoint
app.post("/analyze", upload.single("image"), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: "No image provided." });
        }

        if (!model) {
            return res.status(500).json({ error: "Model not loaded yet. Please retry later." });
        }

        // Convert image buffer to Tensor
        const tensor = tf.node.decodeImage(req.file.buffer)
            .resizeBilinear([224, 224])
            .expandDims(0)
            .toFloat()
            .div(tf.scalar(255));

        // Run model prediction
        const prediction = model.predict(tensor);
        const result = await prediction.data();
        tensor.dispose();

        res.json({ message: "✅ Analysis Complete", result });
    } catch (error) {
        console.error("❌ Error processing image:", error);
        res.status(500).json({ error: "Error analyzing image" });
    }
});

// Serve Uploaded Files
app.use("/uploads", express.static(uploadDir));

// API Health Check
app.get("/", (req, res) => {
    res.json({ message: "✅ Acne Severity Detector API is Running!" });
});

// Graceful Shutdown
process.on("SIGINT", () => {
    console.log("🛑 Shutting down server...");
    process.exit(0);
});

// Start Server
app.listen(PORT, () => {
    console.log(`🚀 Server running at ${BACKEND_URL} on port ${PORT}`);
});
