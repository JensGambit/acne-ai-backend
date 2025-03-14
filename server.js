const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 5000;

// Ensure 'uploads/' directory exists
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// File upload setup
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    },
});

const upload = multer({ storage });

// Image Upload Endpoint
app.post('/upload', upload.single('image'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No image uploaded.' });
    }
    res.status(200).json({ message: 'Image uploaded successfully!', path: `/uploads/${req.file.filename}` });
});

// Serve static files from React build folder
const distPath = path.join(__dirname, 'dist');
if (!fs.existsSync(distPath)) {
    fs.mkdirSync(distPath, { recursive: true });
}
app.use(express.static(distPath, {
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('.css')) {
            res.setHeader('Content-Type', 'text/css');
        }
    }
}));

// Serve Model Files
app.use('/models', express.static(path.join(__dirname, 'public/models')));

// Serve favicon if available
app.get('/favicon.ico', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/favicon.png'));
});

// Catch-all route for React frontend
app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
});

// Start server
app.listen(PORT, () => {
    console.log(`✅ Server running on http://localhost:${PORT}`);
});
