const express = require("express");
const multer = require("multer");
const cors = require("cors");
const tf = require("@tensorflow/tfjs-node");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS for frontend requests
app.use(cors());

// Serve the model file statically (from the root directory)
app.use("/", express.static(path.join(__dirname)));

// Multer setup for file uploads
const upload = multer({ dest: "uploads/" });

// Load TensorFlow model from root directory
let model;
(async () => {
  try {
    console.log("⏳ Loading model...");
    model = await tf.loadLayersModel(`file://${path.join(__dirname, "65model.json")}`);
    console.log("✅ Model loaded successfully!");
  } catch (error) {
    console.error("❌ Error loading model:", error);
  }
})();

// Image Preprocessing
const preprocessImage = async (filePath) => {
  const imageBuffer = fs.readFileSync(filePath);
  const decodedImage = tf.node.decodeImage(imageBuffer);
  const resizedImage = tf.image.resizeBilinear(decodedImage, [224, 224]); // Adjust size
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
    const result = (await prediction.data())[0]; // Adjust based on model output

    fs.unlinkSync(filePath); // Cleanup temp file

    res.json({ prediction: result });
  } catch (error) {
    console.error("❌ Error processing image:", error);
    res.status(500).json({ error: "Prediction failed" });
  }
});

// Start the server
app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
