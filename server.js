require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 5000;

// Directory paths from environment variables or defaults
const uploadDir = process.env.UPLOAD_DIR || path.join(__dirname, 'uploads');
const distPath = process.env.DIST_DIR || path.join(__dirname, 'dist');
const modelPath = process.env.MODEL_DIR || path.join(__dirname, 'public/models');
const faviconPath = path.join(__dirname, 'public/favicon.png');

// Ensure necessary directories exist
[uploadDir, distPath].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

// Middleware
app.use(cors({ origin: '*', methods: 'GET,POST,PUT,DELETE' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// File upload setup with validation
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});

const upload = multer({ 
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        return extname && mimetype ? cb(null, true) : cb(new Error('Only images allowed!'));
    }
});

// Image Upload Endpoint
app.post('/upload', upload.single('image'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No image uploaded.' });
    }
    res.status(200).json({ 
        message: 'Image uploaded successfully!', 
        path: `/uploads/${req.file.filename}` 
    });
});

// Serve static files from React frontend
app.use(express.static(distPath));

// Serve Model Files
app.use('/models', express.static(modelPath));

// Serve favicon if available
app.get('/favicon.ico', (req, res) => {
    return fs.existsSync(faviconPath) ? res.sendFile(faviconPath) : res.status(404).send('Favicon not found');
});

// Catch-all route for React frontend (only if index.html exists)
app.get('*', (req, res) => {
    const indexPath = path.join(distPath, 'index.html');
    return fs.existsSync(indexPath) ? res.sendFile(indexPath) : res.status(404).send('Frontend not built yet. Run `npm run build`.');
});

// Start server
app.listen(PORT, () => console.log(`✅ Server running on http://localhost:${PORT}`));
