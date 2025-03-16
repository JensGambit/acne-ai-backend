import express from "express";
import cors from "cors";
import multer from "multer";
import path from "path";
import fs from "fs";
import dotenv from "dotenv";
import { fileURLToPath } from "url";

// ✅ Load environment variables
dotenv.config();

// ✅ Fix __dirname and __filename for ES modules
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

// ✅ Middleware
app.use(
    cors({
        origin: [FRONTEND_URL, "http://localhost:5173"], // Allow Frontend URLs
        methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
        allowedHeaders: "Origin, X-Requested-With, Content-Type, Accept",
        credentials: true,
    })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ✅ File Upload Setup
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${file.originalname}`);
    },
});

const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } }); // 5MB Limit

// ✅ Image Upload Endpoint
app.post("/upload", upload.single("image"), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: "No image uploaded." });
    }
    res.status(200).json({
        message: "✅ Image uploaded successfully!",
        path: `${BACKEND_URL}/uploads/${req.file.filename}`,
    });
});

// ✅ Serve Model Files (Ensure models are inside `public/models`)
const modelPath = path.join(__dirname, "public/models");
app.use("/models", express.static(modelPath));

// ✅ Serve Uploaded Files
app.use("/uploads", express.static(uploadDir));

// ✅ Start Server
app.listen(PORT, () => {
    console.log(`🚀 Server running at ${BACKEND_URL} on port ${PORT}`);
});
