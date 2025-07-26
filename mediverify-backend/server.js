// server.js - MediVerify Backend Server

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const multer = require('multer');
const path = require('path');

// Import Supabase functions
const {
  verifyQrCode,
  registerManufacturer,
  registerDrug,
  getManufacturers,
  getDrugs,
  saveScanHistory,
  getScanHistory,
  saveCounterfeitReport,
  uploadFileToStorage,
  getExpiringDrugs,
  insertNotification, // New import
  getNotifications    // New import
} = require('./supabaseClient');

const app = express();
const PORT = process.env.PORT || 5000;

// --- HARDCODED ADMIN CREDENTIALS (FOR DEMONSTRATION ONLY) ---
const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = 'password123';
const ADMIN_SESSION_KEY = 'mediverify_admin_secret_key_123';
// --- END HARDCODED CREDENTIALS ---


// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Multer setup for file uploads (for AI verification)
const upload = multer({ storage: multer.memoryStorage() });

// Admin authentication middleware (simple example)
const authenticateAdmin = (req, res, next) => {
  const adminKey = req.headers['x-admin-key'];
  if (adminKey === ADMIN_SESSION_KEY) {
    next();
  } else {
    res.status(403).json({ success: false, message: 'Forbidden: Admin access required.' });
  }
};

// --- API Routes ---

// Public Route: Verify QR Code
app.post('/api/verify-qr', async (req, res) => {
  const { qrCode } = req.body;
  if (!qrCode) {
    return res.status(400).json({ success: false, message: 'QR code is required.' });
  }
  const result = await verifyQrCode(qrCode);
  if (result.success) {
    // Save successful verification to scan history in Supabase
    const userId = 'public_user_id'; // Placeholder: replace with actual user ID from auth
    const scanData = {
      user_id: userId,
      qr_code: result.data.qrCode,
      drug_name: result.data.drugName,
      status: result.data.status,
      is_recalled: result.data.isRecalled,
      scanned_at: new Date().toISOString()
    };
    await saveScanHistory(scanData);

    // NEW: If drug is recalled, insert a notification
    if (result.data.isRecalled) {
        const notificationData = {
            user_id: userId, // Link to the user who scanned it (or a global admin ID)
            type: 'recall_alert',
            message: `URGENT: Drug "${result.data.drugName}" (QR: ${result.data.qrCode}) has been recalled!`,
            related_qr_code: result.data.qrCode,
            is_read: false
        };
        await insertNotification(notificationData);
    }

    res.status(200).json(result);
  } else {
    res.status(404).json(result);
  }
});

// Get Scan History
app.get('/api/get-scan-history', async (req, res) => {
  const userId = req.query.userId || 'public_user_id'; // Placeholder
  const result = await getScanHistory(userId);
  if (result.success) {
    res.status(200).json(result);
  } else {
    res.status(500).json(result);
  }
});

// Report Counterfeit
app.post('/api/report-counterfeit', async (req, res) => {
  const { qrCode, description, contact } = req.body;
  if (!description) {
    return res.status(400).json({ success: false, message: 'Description is required for reporting.' });
  }
  const reportData = {
    qr_code: qrCode || 'N/A',
    description: description,
    contact_info: contact || 'N/A',
    reported_at: new Date().toISOString()
  };
  const result = await saveCounterfeitReport(reportData);
  if (result.success) {
    res.status(200).json(result);
  } else {
    res.status(500).json(result);
  }
});

// NEW ROUTE: Get Notifications
app.get('/api/get-notifications', async (req, res) => {
    const userId = req.query.userId || 'public_user_id'; // Placeholder
    const result = await getNotifications(userId);
    if (result.success) {
        res.status(200).json(result);
    } else {
        res.status(500).json(result);
    }
});

// Admin Route: Admin Login (returns a session key)
app.post('/api/admin-login', (req, res) => {
  const { username, password } = req.body;
  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    res.status(200).json({ success: true, message: 'Admin login successful.', adminKey: ADMIN_SESSION_KEY });
  } else {
    res.status(401).json({ success: false, message: 'Invalid admin credentials.' });
  }
});

// Admin Route: Register Manufacturer
app.post('/api/register-manufacturer', authenticateAdmin, async (req, res) => {
  const manufacturerData = req.body;
  if (!manufacturerData.id || !manufacturerData.name || !manufacturerData.location) {
    return res.status(400).json({ success: false, message: 'Manufacturer ID, Name, and Location are required.' });
  }
  const result = await registerManufacturer(manufacturerData);
  if (result.success) {
    res.status(201).json(result);
  } else {
    res.status(500).json(result);
  }
});

// Admin Route: Register Drug
app.post('/api/register-drug', authenticateAdmin, async (req, res) => {
  const drugData = req.body;
  if (!drugData.qrCode || !drugData.drugName || !drugData.manufacturer || !drugData.batchNumber || !drugData.expiryDate) {
    return res.status(400).json({ success: false, message: 'All drug fields are required.' });
  }
  const supabaseDrugData = {
    qr_code: drugData.qrCode,
    drug_name: drugData.drugName,
    manufacturer_id: drugData.manufacturer,
    batch_number: drugData.batchNumber,
    expiry_date: drugData.expiryDate,
    description: drugData.description || null,
    status: 'Authentic'
  };
  const result = await registerDrug(supabaseDrugData);
  if (result.success) {
    res.status(201).json(result);
  } else {
    res.status(500).json(result);
  }
});

// Admin Route: Get Manufacturers
app.get('/api/get-manufacturers', authenticateAdmin, async (req, res) => {
  const result = await getManufacturers();
  if (result.success) {
    res.status(200).json(result);
  } else {
    res.status(500).json(result);
  }
});

// Admin Route: Get Drugs
app.get('/api/get-drugs', authenticateAdmin, async (req, res) => {
  const result = await getDrugs();
  if (result.success) {
    res.status(200).json(result);
  } else {
    res.status(500).json(result);
  }
});

// Admin Route: Get Expiring Drugs
app.get('/api/get-expiring-drugs', authenticateAdmin, async (req, res) => {
  const days = req.query.days ? parseInt(req.query.days) : 90;
  const result = await getExpiringDrugs(days);
  if (result.success) {
    res.status(200).json(result);
  } else {
    res.status(500).json(result);
  }
});


// Public Route: AI Package Verification (UPLOADS TO SUPABASE STORAGE)
app.post('/api/verify-package-ai', upload.single('packageImage'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No image file uploaded.' });
  }

  const fileBuffer = req.file.buffer;
  const originalname = req.file.originalname;
  const mimetype = req.file.mimetype;
  const fileName = `${Date.now()}-${originalname}`;

  const bucketName = 'mediverify-package-images';
  const filePath = `ai-scans/${fileName}`;

  try {
    const uploadResult = await uploadFileToStorage(bucketName, filePath, fileBuffer, mimetype);

    if (!uploadResult.success) {
      return res.status(500).json({ success: false, message: uploadResult.message });
    }

    const mockAIResult = {
      authenticity: 'Authentic',
      confidence: 0.95,
      details: 'Packaging appears consistent with authentic products. No signs of tampering detected.',
      imageUrl: uploadResult.publicUrl
    };

    setTimeout(() => {
      res.status(200).json({ success: true, message: 'AI analysis complete.', data: mockAIResult });
    }, 2000);

  } catch (error) {
    console.error('Error during AI verification and upload:', error);
    res.status(500).json({ success: false, message: 'An unexpected server error occurred during AI verification and upload.' });
  }
});

// Basic route for the root path (/)
app.get('/', (req, res) => {
  res.status(200).send('MediVerify Backend API is running. Access the frontend application at its dedicated URL.');
});

// Start the server
app.listen(PORT, () => {
  console.log(`MediVerify Backend running on port ${PORT}`);
  console.log(`Public URL: http://localhost:${PORT}`);
});
