import express from "express";
import cors from "cors";
import multer from "multer";
import path from "path";
import fs from "fs";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import * as tf from "@tensorflow/tfjs-node";

// ✅ Load environment variables
dotenv.config();

// ✅ Fix __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// ✅ Define Backend & Frontend URLs
const BACKEND_URL = process.env.BACKEND_URL || "https://acne-ai-backend.onrender.com";
const FRONTEND_URL = process.env.FRONTEND_URL || "https://acneseverityai.netlify.app";

// ✅ Ensure 'uploads/' directory exists
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// ✅ Middleware Setup
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

// ✅ Multer Storage (Using memoryStorage for TensorFlow Processing)
const storage = multer.memoryStorage();
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } }); // 5MB Limit

// ✅ Load the TensorFlow Model
let model;
(async () => {
    try {
        model = await tf.loadLayersModel(`file://${path.join(__dirname, "public", "models", "model.json")}`);
        console.log("✅ Model loaded successfully!");
    } catch (error) {
        console.error("❌ Error loading model:", error);
    }
})();

// ✅ Image Upload & Prediction Endpoint
app.post("/predict", upload.single("image"), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: "No image uploaded." });
        }
        
        // ✅ Process Image
        const imageBuffer = req.file.buffer;
        const tensor = tf.node.decodeImage(imageBuffer, 3)
            .resizeNearestNeighbor([224, 224])
            .expandDims()
            .toFloat().div(tf.scalar(255));
        
        // ✅ Perform Prediction
        const prediction = model.predict(tensor);
        const scores = prediction.arraySync()[0];
        const classIndex = scores.indexOf(Math.max(...scores));
        const severityLabels = ["Extremely Mild", "Mild", "Moderate", "Severe"];
        
        res.status(200).json({
            severity: severityLabels[classIndex],
            confidence: scores[classIndex],
        });
    } catch (error) {
        console.error("❌ Prediction Error:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// ✅ Serve Model Files (Ensure models are inside `public/models`)
const modelPath = path.join(__dirname, "public", "models");
if (!fs.existsSync(modelPath)) {
    console.error("❌ Model directory not found:", modelPath);
}
app.use("/models", express.static(modelPath));

// ✅ Serve Uploaded Files
app.use("/uploads", express.static(uploadDir));

// ✅ API Health Check
app.get("/", (req, res) => {
    res.json({ message: "✅ Acne Severity Detector API is Running!" });
});

// ✅ Start Server
app.listen(PORT, () => {
    console.log(`🚀 Server running at ${BACKEND_URL} on port ${PORT}`);
});
