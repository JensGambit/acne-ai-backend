const express = require("express");
const multer = require("multer");
const cors = require("cors");
const tf = require("@tensorflow/tfjs-node");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 5000; // Dynamic port for Render

// Enable CORS for frontend access
app.use(cors());

// Multer setup for file uploads
const upload = multer({ dest: "uploads/" });

// Load TensorFlow model
let model;
(async () => {
  try {
    console.log("⏳ Loading model...");
    model = await tf.loadLayersModel("file://models/65model.json"); // Load model from local directory
    console.log("✅ Model loaded successfully!");
  } catch (error) {
    console.error("❌ Error loading model:", error);
  }
})();

// Image Preprocessing Function
const preprocessImage = async (filePath) => {
  const imageBuffer = fs.readFileSync(filePath);
  const decodedImage = tf.node.decodeImage(imageBuffer);
  const resizedImage = tf.image.resizeBilinear(decodedImage, [224, 224]); // Resize to model input size
  const normalizedImage = resizedImage.div(tf.scalar(255)).expandDims();
  return normalizedImage;
};

// Prediction Route
app.post("/predict", upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  try {
    const filePath = path.join(__dirname, req.file.path);
    const processedImage = await preprocessImage(filePath);
    const prediction = model.predict(processedImage);
    const result = (await prediction.data())[0]; // Extract prediction result

    fs.unlinkSync(filePath); // Delete temp file after processing

    res.json({ prediction: result });
  } catch (error) {
    console.error("❌ Error processing image:", error);
    res.status(500).json({ error: "Prediction failed" });
  }
});

// Start Server
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
