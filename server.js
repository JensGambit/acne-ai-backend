const express = require("express");
const multer = require("multer");
const cors = require("cors");
const tf = require("@tensorflow/tfjs-node");
const fs = require("fs");
const path = require("path");

// Initialize Express app
const app = express();
const port = process.env.PORT || 5000;

// Enable CORS
app.use(
  cors({
    origin: "*", // Allow all origins (replace with your frontend URL in production)
    methods: ["POST"], // Allow only POST requests
  })
);

// Set up multer for file uploads
const upload = multer({
  dest: "uploads/", // Temporary folder for uploaded files
  limits: { fileSize: 5 * 1024 * 1024 }, // Limit file size to 5MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true); // Accept the file
    } else {
      cb(new Error("Invalid file type. Only images are allowed.")); // Reject the file
    }
  },
});

// Load your TensorFlow.js model
const MODEL_PATH = path.join(__dirname, "public", "models", "model.json");
let model;

async function loadModel() {
  try {
    console.log("Loading model...");
    model = await tf.loadLayersModel(`file://${MODEL_PATH}`);
    console.log("Model loaded!");
  } catch (err) {
    console.error("Failed to load model:", err);
    process.exit(1); // Exit if the model fails to load
  }
}

// Preprocess the image
function preprocessImage(imageBuffer) {
  const imageTensor = tf.node.decodeImage(imageBuffer);
  const resizedImage = tf.image.resizeBilinear(imageTensor, [224, 224]);
  const normalizedImage = resizedImage.div(tf.scalar(255)).expandDims();
  return normalizedImage;
}

// Predict using the model
async function predict(imageTensor) {
  const predictions = await model.predict(imageTensor);
  const severityLevel = predictions.argMax(1).dataSync()[0];
  const confidence = predictions.max().dataSync()[0];
  return { severityLevel, confidence };
}

// Analyze image endpoint
app.post("/analyze", upload.single("image"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No image file uploaded." });
  }

  const imagePath = req.file.path;

  try {
    // Read the uploaded image
    const imageBuffer = await fs.promises.readFile(imagePath);

    // Preprocess the image
    const imageTensor = preprocessImage(imageBuffer);

    // Predict using the model
    const { severityLevel, confidence } = await predict(imageTensor);

    // Clean up the uploaded file
    await fs.promises.unlink(imagePath);

    // Send the result
    res.json({
      severityLevel,
      confidence,
      message: "Analysis complete!",
    });
  } catch (err) {
    console.error("Error analyzing image:", err);

    // Clean up the uploaded file in case of error
    if (fs.existsSync(imagePath)) {
      await fs.promises.unlink(imagePath);
    }

    res.status(500).json({ error: "Failed to analyze image." });
  }
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({ status: "OK", message: "Server is running." });
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});

// Load the model when the server starts
loadModel();
