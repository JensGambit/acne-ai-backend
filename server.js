import express from "express";
import cors from "cors";
import multer from "multer";
import path from "path";
import fs from "fs";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import * as tf from "@tensorflow/tfjs-node"; // TensorFlow.js for Node.js

// ✅ Load environment variables
dotenv.config();

// ✅ Fix __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 10000;

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

// ✅ Load TensorFlow Model
let model;
const loadModel = async () => {
    try {
        const modelPath = path.join(__dirname, "public", "models", "model.json");
        model = await tf.loadLayersModel(`file://${modelPath}`);
        
        // ✅ Ensure model has an input layer
        if (!model.inputs || model.inputs.length === 0) {
            console.error("❌ Model missing InputLayer. Rebuilding...");
            model.add(tf.input({ shape: [224, 224, 3] })); // Ensure correct input shape
        }

        console.log("✅ Model loaded successfully!");
    } catch (error) {
        console.error("❌ Error loading model:", error);
    }
};

// ✅ Call model loading function
loadModel();

// ✅ Image Upload Endpoint
app.post("/upload", upload.single("image"), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: "No image uploaded." });
        }

        const filePath = path.join(uploadDir, `${Date.now()}-${req.file.originalname}`);
        await fs.promises.writeFile(filePath, req.file.buffer); // ✅ Save image asynchronously

        res.status(200).json({
            message: "✅ Image uploaded successfully!",
            path: `${BACKEND_URL}/uploads/${path.basename(filePath)}`,
        });
    } catch (error) {
        console.error("❌ Image Upload Error:", error);
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
