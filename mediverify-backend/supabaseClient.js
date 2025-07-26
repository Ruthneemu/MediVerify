// supabaseClient.js - Supabase client setup and database interaction functions
// !!! WARNING: API keys are hardcoded here for demonstration as per user request.
// !!! This is a MAJOR SECURITY RISK and NOT recommended for production.
// !!! Always use environment variables (e.g., Replit Secrets) for sensitive credentials.

const { createClient } = require('@supabase/supabase-js');

// --- HARDCODED SUPABASE CREDENTIALS (FOR DEMONSTRATION ONLY) ---
const supabaseUrl = 'https://ajdkbfdylpntwmtkirlg.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFqZGtiZmR5bHBudHdtdGtpcmxnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM1MTQ3NzQsImV4cCI6MjA2OTA5MDc3NH0.bCNBNHqp1NU1OW5z_qmKl1KVftB1Zq7AFkmcugEJ2ls';
const supabaseServiceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFqZGtiZmR5bHBudHdtdGtpcmxnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MzUxNDc3NCwiZXhwIjoyMDY5MDkwNzc0fQ.o-HkAlRE3yk3BUiY3Vl6YZfLa4ASZ37VZ_fRCJPqZAw';
// --- END HARDCODED CREDENTIALS ---

// Initialize Supabase client for public access (used by verify-qr)
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Initialize Supabase client with service role key for admin operations
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

// Function to verify QR code against the 'drugs' table
async function verifyQrCode(qrCode) {
  try {
    const { data, error } = await supabase
      .from('drugs')
      .select('*')
      .eq('qr_code', qrCode)
      .single(); // Expecting only one result

    if (error && error.code === 'PGRST116') { // No rows found
      return { success: false, message: 'Drug not found or QR code is invalid.' };
    }
    if (error) {
      console.error('Supabase query error (verifyQrCode):', error);
      return { success: false, message: `Database error: ${error.message}` };
    }

    // Simulate recall status from backend if 'RECALL' is in QR code
    const isRecalled = qrCode.toUpperCase().includes('RECALL');

    return {
      success: true,
      message: 'Drug verified successfully!',
      data: {
        qrCode: data.qr_code,
        drugName: data.drug_name,
        manufacturer: data.manufacturer_id, // Assuming manufacturer_id is stored
        batchNumber: data.batch_number,
        expiryDate: data.expiry_date,
        description: data.description,
        status: 'Authentic', // Or derive from database if you have a status column
        supplyChain: [ // Example supply chain data
          `Manufactured by ${data.manufacturer_id} on ${new Date().toLocaleDateString()}`,
          `Distributed to warehouse on ${new Date(Date.now() - 86400000).toLocaleDateString()}`, // 1 day ago
          `Delivered to pharmacy on ${new Date(Date.now() - 43200000).toLocaleDateString()}`  // 0.5 days ago
        ],
        isRecalled: isRecalled // Pass the simulated recall status
      }
    };
  } catch (err) {
    console.error('Unexpected error in verifyQrCode:', err);
    return { success: false, message: 'An unexpected server error occurred during verification.' };
  }
}

// Function to register a new manufacturer (admin only)
async function registerManufacturer(manufacturerData) {
  try {
    const { data, error } = await supabaseAdmin
      .from('manufacturers') // Assuming you have a 'manufacturers' table
      .insert([manufacturerData]);

    if (error) {
      console.error('Supabase insert error (registerManufacturer):', error);
      return { success: false, message: `Failed to register manufacturer: ${error.message}` };
    }
    return { success: true, message: 'Manufacturer registered successfully!' };
  } catch (err) {
    console.error('Unexpected error in registerManufacturer:', err);
    return { success: false, message: 'An unexpected server error occurred during manufacturer registration.' };
  }
}

// Function to register a new drug (admin only)
async function registerDrug(drugData) {
  try {
    const { data, error } = await supabaseAdmin
      .from('drugs') // Assuming you have a 'drugs' table
      .insert([drugData]);

    if (error) {
      console.error('Supabase insert error (registerDrug):', error);
      return { success: false, message: `Failed to register drug: ${error.message}` };
    }
    return { success: true, message: 'Drug registered successfully!' };
  } catch (err) {
    console.error('Unexpected error in registerDrug:', err);
    return { success: false, message: 'An unexpected server error occurred during drug registration.' };
  }
}

// Function to get all manufacturers (admin only)
async function getManufacturers() {
  try {
    const { data, error } = await supabaseAdmin
      .from('manufacturers')
      .select('*');

    if (error) {
      console.error('Supabase query error (getManufacturers):', error);
      return { success: false, message: `Failed to fetch manufacturers: ${error.message}` };
    }
    return { success: true, data: data };
  } catch (err) {
    console.error('Unexpected error in getManufacturers:', err);
    return { success: false, message: 'An unexpected server error occurred while fetching manufacturers.' };
  }
}

// Function to get all registered drugs (admin only)
async function getDrugs() {
  try {
    const { data, error } = await supabaseAdmin
      .from('drugs')
      .select('*');

    if (error) {
      console.error('Supabase query error (getDrugs):', error);
      return { success: false, message: `Failed to fetch drugs: ${error.message}` };
    }
    return { success: true, data: data };
  } catch (err) {
    console.error('Unexpected error in getDrugs:', err);
    return { success: false, message: 'An unexpected server error occurred while fetching drugs.' };
  }
}

// Function to get drugs expiring soon (admin view)
async function getExpiringDrugs(daysThreshold = 90) { // Default to 90 days
  try {
    const today = new Date();
    const expiryThresholdDate = new Date();
    expiryThresholdDate.setDate(today.getDate() + daysThreshold);

    // Format dates to YYYY-MM-DD for comparison with Supabase date column
    const todayISO = today.toISOString().split('T')[0];
    const expiryThresholdISO = expiryThresholdDate.toISOString().split('T')[0];

    const { data, error } = await supabaseAdmin
      .from('drugs')
      .select('*')
      .gte('expiry_date', todayISO) // Expiry date is today or in the future
      .lte('expiry_date', expiryThresholdISO) // Expiry date is within the threshold
      .order('expiry_date', { ascending: true }); // Order by soonest expiry

    if (error) {
      console.error('Supabase query error (getExpiringDrugs):', error);
      return { success: false, message: `Failed to fetch expiring drugs: ${error.message}` };
    }
    return { success: true, data: data };
  } catch (err) {
    console.error('Unexpected error in getExpiringDrugs:', err);
    return { success: false, message: 'An unexpected server error occurred while fetching expiring drugs.' };
  }
}


// Save scan history to Supabase 'scans' table
async function saveScanHistory(scanData) {
  try {
    const { data, error } = await supabase
      .from('scans') // Assuming you have a 'scans' table
      .insert([scanData]);

    if (error) {
      console.error('Supabase insert error (saveScanHistory):', error);
      return { success: false, message: `Failed to save scan history: ${error.message}` };
    }
    return { success: true, message: 'Scan history saved successfully!' };
  } catch (err) {
    console.error('Unexpected error in saveScanHistory:', err);
    return { success: false, message: 'An unexpected server error occurred while saving scan history.' };
  }
}

// Get scan history from Supabase 'scans' table
async function getScanHistory(userId = null) { // userId is optional for now, but good for future auth
  try {
    let query = supabase.from('scans').select('*');

    // If a userId is provided, filter by it (for future authentication)
    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data, error } = await query.order('scanned_at', { ascending: false }).limit(20); // Get latest 20 scans

    if (error) {
      console.error('Supabase query error (getScanHistory):', error);
      return { success: false, message: `Failed to fetch scan history: ${error.message}` };
    }
    return { success: true, data: data };
  } catch (err) {
    console.error('Unexpected error in getScanHistory:', err);
    return { success: false, message: 'An unexpected server error occurred while fetching scan history.' };
  }
}

// Simulate saving a counterfeit report (to a 'reports' table)
async function saveCounterfeitReport(reportData) {
  try {
    // In a real app, you'd save this to a 'counterfeit_reports' table in Supabase
    // For now, we'll just simulate success.
    console.log('Simulating saving counterfeit report:', reportData);
    // const { data, error } = await supabase.from('counterfeit_reports').insert([reportData]);
    // if (error) throw error;
    return { success: true, message: 'Counterfeit report received and will be reviewed.' };
  } catch (err) {
    console.error('Error simulating counterfeit report:', err);
    return { success: false, message: `Failed to submit report: ${err.message}` };
  }
}

// Upload file to Supabase Storage
async function uploadFileToStorage(bucketName, filePath, fileBuffer, fileType) {
  try {
    const { data, error } = await supabaseAdmin.storage
      .from(bucketName)
      .upload(filePath, fileBuffer, {
        contentType: fileType,
        upsert: true // Overwrite if file exists
      });

    if (error) {
      console.error('Supabase Storage upload error:', error);
      return { success: false, message: `Failed to upload file to storage: ${error.message}` };
    }

    // Get the public URL of the uploaded file
    const { data: publicUrlData } = supabaseAdmin.storage
      .from(bucketName)
      .getPublicUrl(filePath);

    return { success: true, message: 'File uploaded successfully!', publicUrl: publicUrlData.publicUrl };

  } catch (err) {
    console.error('Unexpected error in uploadFileToStorage:', err);
    return { success: false, message: 'An unexpected server error occurred during file upload.' };
  }
}

// NEW FUNCTION: Insert a notification into the 'notifications' table
async function insertNotification(notificationData) {
  try {
    const { data, error } = await supabaseAdmin
      .from('notifications')
      .insert([notificationData]);

    if (error) {
      console.error('Supabase insert error (insertNotification):', error);
      return { success: false, message: `Failed to insert notification: ${error.message}` };
    }
    return { success: true, message: 'Notification inserted successfully!' };
  } catch (err) {
    console.error('Unexpected error in insertNotification:', err);
    return { success: false, message: 'An unexpected server error occurred during notification insertion.' };
  }
}

// NEW FUNCTION: Get notifications for a user
async function getNotifications(userId = 'public_user_id') { // Default to public_user_id for now
  try {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false }); // Get latest notifications first

    if (error) {
      console.error('Supabase query error (getNotifications):', error);
      return { success: false, message: `Failed to fetch notifications: ${error.message}` };
    }
    return { success: true, data: data };
  } catch (err) {
    console.error('Unexpected error in getNotifications:', err);
    return { success: false, message: 'An unexpected server error occurred while fetching notifications.' };
  }
}


module.exports = {
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
  insertNotification, // Export new function
  getNotifications    // Export new function
};
