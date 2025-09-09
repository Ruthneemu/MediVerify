// This file demonstrates a backend server that handles both QR codes and image uploads
// for smart drug verification and diagnostics.
// It uses Express, Multer, and a mock AI service.

const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { createClient } = require('@supabase/supabase-js');

// These imports are for the Supabase client
const {
  getDrugByQRCode,
  getDrugByImage,
  insertVerificationResult,
  uploadFileToStorage,
  getSupabase,
} = require('./supabaseClient');

// Initialize the Express app
const app = express();
const port = 3001;

// Supabase configuration
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

// Initialize Supabase client
const supabase = createClient(supabaseUrl, supabaseKey);

// Use cors middleware to allow cross-origin requests from the frontend
app.use(cors());
app.use(express.json());

// Set up multer for file uploads, storing files in memory
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

/**
 * Mock function to simulate a call to an AI visual recognition model.
 * In a real-world scenario, you would replace this with an actual API call
 * to a service like Google Cloud Vision AI or AWS Rekognition.
 *
 * @param {string} imageUrl The URL of the image to analyze.
 * @returns {Promise<object>} A promise that resolves to a comprehensive analysis result.
 */
async function callAIVisualModel(imageUrl) {
  console.log(`Calling mock AI model with image URL: ${imageUrl}`);

  // Simulate a network delay
  await new Promise(resolve => setTimeout(resolve, 2000));

  // This is a hardcoded response to simulate the AI model's output.
  // A real response would be more dynamic and based on the image analysis.
  const analysisResult = {
    drugName: 'Paracetamol',
    purpose: 'Pain relief and fever reduction',
    sideEffects: ['Nausea', 'Stomach pain', 'Loss of appetite'],
    authenticityScore: (Math.random() * 0.2 + 0.8).toFixed(2), // Random score between 0.8 and 1.0
    visualAnalysis: {
      colorMatch: 'High',
      shapeMatch: 'High',
      packagingIntegrity: 'High',
    },
  };

  return {
    isAuthentic: analysisResult.authenticityScore >= 0.9,
    ...analysisResult,
  };
}

// POST endpoint for drug verification
app.post('/api/verify-qr', upload.single('drugImage'), async (req, res) => {
  const { qrCode } = req.body;
  const drugImage = req.file;

  try {
    if (qrCode) {
      // Handle QR code verification
      const drug = await getDrugByQRCode(qrCode);
      if (drug) {
        // Mock a comprehensive result for the QR code lookup
        const result = {
          isAuthentic: true,
          drugName: drug.name,
          purpose: drug.purpose,
          sideEffects: drug.side_effects,
          authenticityScore: '1.0',
          visualAnalysis: 'N/A', // Not applicable for QR code
        };
        await insertVerificationResult(qrCode, null, result);
        return res.json({ success: true, data: result });
      }
      return res.status(404).json({ success: false, message: 'Drug not found by QR code.' });
    } else if (drugImage) {
      // Handle image verification
      const imageUrl = await uploadFileToStorage(drugImage);
      if (!imageUrl) {
        return res.status(500).json({ success: false, message: 'Failed to upload image.' });
      }

      // Call the mock AI service with the image URL
      const aiResponse = await callAIVisualModel(imageUrl);
      const isAuthentic = aiResponse.authenticityScore >= 0.9;

      // Now, try to find the drug by the name provided by the AI model
      const drugFromDb = await getDrugByImage(aiResponse.drugName);

      if (drugFromDb) {
        const result = {
          isAuthentic: isAuthentic,
          drugName: drugFromDb.name,
          purpose: drugFromDb.purpose,
          sideEffects: drugFromDb.side_effects,
          authenticityScore: aiResponse.authenticityScore,
          visualAnalysis: aiResponse.visualAnalysis,
        };
        await insertVerificationResult(null, imageUrl, result);
        return res.json({ success: true, data: result });
      }

      return res.status(404).json({ success: false, message: 'Drug not found based on AI analysis.' });
    } else {
      return res.status(400).json({ success: false, message: 'Missing QR code or drug image.' });
    }
  } catch (error) {
    console.error('Verification error:', error);
    return res.status(500).json({ success: false, message: 'An error occurred during verification.' });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
