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

// ✅ CORS Setup (Allow Frontend Requests)
const FRONTEND_URL = process.env.FRONTEND_URL || "https://acneseverityai.netlify.app";
app.use(cors({
    origin: FRONTEND_URL,
    credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ✅ Ensure Upload Directory Exists
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// ✅ Multer for File Uploads
const storage = multer.memoryStorage();
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } }); // 5MB Limit

// ✅ Load TensorFlow Model
let model;
const loadModel = async () => {
    try {
        console.log("⏳ Loading TensorFlow model...");
        const modelPath = `file://${path.join(__dirname, "public", "models", "model.json")}`;
        model = await tf.loadLayersModel(modelPath);

        // Pre-warm model to reduce cold start time
        const dummyInput = tf.zeros([1, 224, 224, 3]);
        model.predict(dummyInput);
        dummyInput.dispose();

        console.log("✅ Model loaded successfully!");
    } catch (error) {
        console.error("❌ Error loading model:", error);
        process.exit(1);
    }
};

// ✅ Call model loading function
loadModel();

// ✅ Image Upload Endpoint
app.post("/upload", upload.single("image"), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: "No image uploaded." });

        const filePath = path.join(uploadDir, `${Date.now()}-${req.file.originalname}`);
        await fs.promises.writeFile(filePath, req.file.buffer);

        res.status(200).json({
            message: "✅ Image uploaded successfully!",
            path: `/uploads/${path.basename(filePath)}`,
        });
    } catch (error) {
        console.error("❌ Image Upload Error:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// ✅ Image Analysis Endpoint
app.post("/analyze", upload.single("image"), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: "No image provided." });

        if (!model) return res.status(500).json({ error: "Model not loaded yet. Please retry later." });

        const tensor = tf.node.decodeImage(req.file.buffer)
            .resizeBilinear([224, 224])
            .expandDims(0)
            .toFloat()
            .div(tf.scalar(255));

        const prediction = model.predict(tensor);
        const result = await prediction.data();
        tensor.dispose();

        res.json({ message: "✅ Analysis Complete", result });
    } catch (error) {
        console.error("❌ Error processing image:", error);
        res.status(500).json({ error: "Error analyzing image" });
    }
});

// ✅ Serve Model Files
app.use("/models", express.static(path.join(__dirname, "public", "models")));

// ✅ Serve Uploaded Files
app.use("/uploads", express.static(uploadDir));

// ✅ API Health Check
app.get("/", (req, res) => {
    res.json({ message: "✅ Acne Severity Detector API is Running on Render!" });
});

// ✅ Start Server
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});
