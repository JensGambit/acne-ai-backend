require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 5000;

// ✅ Define Backend URL for CORS
const BACKEND_URL = "https://acne-ai-backend.onrender.com";
const FRONTEND_URL = "https://acneseverity.onrender.com";

// ✅ Ensure 'uploads/' directory exists
const uploadDir = process.env.UPLOAD_DIR || path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// ✅ Middleware
app.use(cors({
    origin: FRONTEND_URL, // Allow frontend access
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
    allowedHeaders: "Origin, X-Requested-With, Content-Type, Accept",
    credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ✅ File upload setup
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${file.originalname}`);
    },
});

const upload = multer({ 
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // Limit file size to 5MB
});

// ✅ Image Upload Endpoint
app.post('/upload', upload.single('image'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No image uploaded.' });
    }
    res.status(200).json({ 
        message: 'Image uploaded successfully!', 
        path: `${BACKEND_URL}/uploads/${req.file.filename}` 
    });
});

// ✅ Serve static files from React build folder with correct MIME types
const distPath = process.env.DIST_DIR || path.join(__dirname, 'dist');
if (!fs.existsSync(distPath)) {
    fs.mkdirSync(distPath, { recursive: true });
}

app.use(express.static(distPath, {
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('.js')) {
            res.setHeader('Content-Type', 'application/javascript');
        }
        if (filePath.endsWith('.css')) {
            res.setHeader('Content-Type', 'text/css');
        }
    }
}));

// ✅ Serve Model Files
const modelPath = process.env.MODEL_DIR || path.join(__dirname, 'public/models');
app.use('/models', express.static(modelPath));

// ✅ Serve uploads folder (for images)
app.use('/uploads', express.static(uploadDir));

// ✅ Serve favicon if available
app.get('/favicon.ico', (req, res) => {
    const faviconPath = path.join(__dirname, 'public/favicon.png');
    if (fs.existsSync(faviconPath)) {
        res.sendFile(faviconPath);
    } else {
        res.status(404).send('Favicon not found');
    }
});

// ✅ Catch-all route for React frontend (only if index.html exists)
app.get('*', (req, res) => {
    const indexPath = path.join(distPath, 'index.html');
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        res.status(404).send('Frontend not built yet. Run `npm run build`.');
    }
});

// ✅ Start server
app.listen(PORT, () => {
    console.log(`✅ Server running at ${BACKEND_URL}`);
