require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 5000;

// Backend URL for the frontend to connect
const FRONTEND_URL = "https://acneseverity.onrender.com";

// Ensure 'uploads/' directory exists
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Middleware
app.use(cors({ origin: FRONTEND_URL, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// File upload setup
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname)),
});
const upload = multer({ storage });

// Image Upload Endpoint
app.post('/upload', upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No image uploaded.' });
    }
    res.status(200).json({ message: 'Image uploaded successfully!', path: `/uploads/${req.file.filename}` });
});

// ✅ New Endpoint for Model Processing (Dummy Implementation)
app.post('/predict', upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No image uploaded for prediction.' });
    }
    
    // Simulate AI prediction response
    const severityLevel = Math.floor(Math.random() * 4); // Random severity level 0-3
    res.status(200).json({ prediction: severityLevel });
});

// Serve static files from React build folder
const distPath = path.join(__dirname, 'dist');
app.use(express.static(distPath));
app.use('/models', express.static(path.join(__dirname, 'public/models')));

// Serve favicon if available
app.get('/favicon.ico', (req, res) => {
    const faviconPath = path.join(__dirname, 'public/favicon.png');
    if (fs.existsSync(faviconPath)) {
        res.sendFile(faviconPath);
    } else {
        res.status(404).send('Favicon not found');
    }
});

// Serve frontend
app.get('*', (req, res) => {
    const indexPath = path.join(distPath, 'index.html');
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        res.status(404).send('Frontend not built yet. Run `npm run build`.');
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`✅ Server running on http://localhost:${PORT}`);
});
