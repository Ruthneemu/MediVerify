// App.js - MediVerify Web Frontend with Notification System

import React, { useState, useEffect } from 'react';
import { QrReader } from 'react-qr-reader';

function App() {
  // --- Core Verification States ---
  const [scanResult, setScanResult] = useState('');
  const [facingMode, setFacingMode] = useState('environment');
  const [message, setMessage] = useState('Point your camera at a drug\'s QR code or enter it manually.');
  const [verificationData, setVerificationData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [manualQrInput, setManualQrInput] = useState('');

  // --- AI Verification States ---
  const [selectedFile, setSelectedFile] = useState(null);
  const [aiResult, setAiResult] = useState(null);
  const [isUploading, setIsUploading] = useState(false);

  // --- Navigation/Admin States ---
  const [currentPage, setCurrentPage] = useState('verify');
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false); // Tracks admin login status
  const [adminSessionKey, setAdminSessionKey] = useState(null); // Stores the admin key from backend

  // --- Admin Data States (Fetched from Backend, which uses Supabase) ---
  const [manufacturers, setManufacturers] = useState([]);
  const [registeredDrugs, setRegisteredDrugs] = useState([]);
  const [newManufacturer, setNewManufacturer] = useState({ id: '', name: '', location: '', contact: '' });
  const [newDrug, setNewDrug] = useState({ qrCode: '', drugName: '', manufacturer: '', batchNumber: '', expiryDate: '', description: '' });

  // --- NEW FEATURE STATES ---
  const [scanHistory, setScanHistory] = useState([]); // Now fetched from Supabase
  const [reportCounterfeitData, setReportCounterfeitData] = useState({ qrCode: '', description: '', contact: '' });
  const [expiringDrugs, setExpiringDrugs] = useState([]); // For admin view
  const [expiryThresholdDays, setExpiryThresholdDays] = useState(90); // Default for admin expiry view
  const [notifications, setNotifications] = useState([]); // Stores notifications
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);

  // IMPORTANT: This MUST be your Replit backend's public URL.
  // REPLACE THIS PLACEHOLDER WITH YOUR ACTUAL BACKEND PUBLIC URL (e.g., https://your-backend-slug.replit.dev/api)
  const API_BASE_URL = 'https://07ecd53a-4463-400d-a252-37769a5e9e7f-00-1fva6us9oqckd.spock.replit.dev/api'; // <--- UPDATE THIS LINE WITH YOUR BACKEND'S URL

  // --- Utility Function for Expiry Check ---
  const isExpiringSoon = (expiryDateString, days = 90) => {
    if (!expiryDateString) return false;
    const expiry = new Date(expiryDateString);
    const today = new Date();
    const futureDate = new Date();
    futureDate.setDate(today.getDate() + days);
    return expiry > today && expiry <= futureDate;
  };

  // --- Data Fetching Functions (Admin Only) ---
  const fetchManufacturers = async () => {
    if (!isAdminLoggedIn || !adminSessionKey) return;
    setIsLoading(true);
    setMessage('Fetching manufacturers...');
    try {
      const response = await fetch(`${API_BASE_URL}/get-manufacturers`, {
        headers: { 'X-Admin-Key': adminSessionKey } // Send custom admin key
      });
      const result = await response.json();
      if (response.ok && result.success) {
        setManufacturers(result.data);
        setMessage('Manufacturers loaded.');
      } else {
        setMessage(`Failed to load manufacturers: ${result.message}`);
      }
    } catch (error) {
      console.error('Error fetching manufacturers:', error);
      setMessage('Network error while fetching manufacturers.');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchRegisteredDrugs = async () => {
    if (!isAdminLoggedIn || !adminSessionKey) return;
    setIsLoading(true);
    setMessage('Fetching registered drugs...');
    try {
      const response = await fetch(`${API_BASE_URL}/get-drugs`, {
        headers: { 'X-Admin-Key': adminSessionKey } // Send custom admin key
      });
      const result = await response.json();
      if (response.ok && result.success) {
        setRegisteredDrugs(result.data);
        setMessage('Registered drugs loaded.');
      } else {
        setMessage(`Failed to load drugs: ${result.message}`);
      }
    } catch (error) {
      console.error('Error fetching registered drugs:', error);
      setMessage('Network error while fetching registered drugs.');
    } finally {
      setIsLoading(false);
    }
  };

  // NEW: Fetch expiring drugs for admin view
  const fetchExpiringDrugs = async (days) => {
    if (!isAdminLoggedIn || !adminSessionKey) return;
    setIsLoading(true);
    setMessage(`Fetching drugs expiring within ${days} days...`);
    try {
      const response = await fetch(`${API_BASE_URL}/get-expiring-drugs?days=${days}`, {
        headers: { 'X-Admin-Key': adminSessionKey }
      });
      const result = await response.json();
      if (response.ok && result.success) {
        setExpiringDrugs(result.data);
        setMessage(`Expiring drugs loaded for ${days} days.`);
      } else {
        setExpiringDrugs([]);
        setMessage(`Failed to load expiring drugs: ${result.message || 'None found or error.'}`);
      }
    } catch (error) {
      console.error('Error fetching expiring drugs:', error);
      setMessage('Network error while fetching expiring drugs.');
    } finally {
      setIsLoading(false);
    }
  };


  // --- Core Verification Functions ---

  const handleVerify = async (qrCodeToVerify) => {
    if (!qrCodeToVerify) {
      setMessage('Please scan a QR code or enter it manually.');
      return;
    }

    setIsLoading(true);
    setMessage('Verifying drug authenticity...');
    setVerificationData(null);
    setAiResult(null);
    setCameraError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/verify-qr`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ qrCode: qrCodeToVerify }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        // Add client-side check for expiry soon
        const expirySoon = isExpiringSoon(result.data.expiryDate);
        const verifiedDataWithExpiry = { ...result.data, expirySoon };

        setVerificationData(verifiedDataWithExpiry);
        setMessage(`Verification successful: ${result.message}`);
        fetchScanHistory(); // Refresh scan history after a new scan
      } else {
        setMessage(`Verification failed: ${result.message || 'An unknown error occurred.'}`);
        setVerificationData(null);
      }
    } catch (error) {
      console.error('Error during QR verification:', error);
      setMessage('Network error or backend is unreachable. Please ensure your backend is running and accessible, and the API_BASE_URL is correct.');
      setVerificationData(null);
    } finally {
      setIsLoading(false);
      if (!message.includes('Error') && !message.includes('failed')) {
          setTimeout(() => {
              setMessage('Scan another QR code or enter it manually.');
          }, 7000);
      }
    }
  };

  const handleQrReaderResult = (result, error) => {
    if (!!result) {
      setScanResult(result.text);
      setManualQrInput(result.text);
      handleVerify(result.text);
    }
    if (!!error && error.name !== "NotAllowedError" && error.name !== "OverconstrainedError" && error.name !== "NotFoundError") {
      console.error('QR Reader specific error:', error);
    }
  };

  const handleError = (err) => {
    console.error('Camera Error:', err);
    setCameraError(err.message || 'Error accessing camera.');
    setMessage('Camera access denied or not found. Please ensure camera permissions are granted and try refreshing the page. If in a sandboxed environment (like Replit\'s webview), camera access might be restricted. You can still use manual QR input.');
  };

  const toggleCamera = () => {
    setFacingMode(prevMode => (prevMode === 'environment' ? 'user' : 'environment'));
    setMessage(`Switched to ${facingMode === 'environment' ? 'front' : 'back'} camera.`);
    setCameraError(null); // Clear camera error when toggling
  };

  // --- AI Verification Functions ---

  const handleFileChange = (event) => {
    setSelectedFile(event.target.files[0]);
    setAiResult(null);
  };

  const verifyPackageAI = async () => {
    if (!selectedFile) {
      setMessage('Please select an image file first for AI verification.');
      return;
    }

    setIsUploading(true);
    setMessage('Uploading image for AI analysis...');
    setAiResult(null);
    setVerificationData(null);

    const formData = new FormData();
    formData.append('packageImage', selectedFile);

    try {
      const response = await fetch(`${API_BASE_URL}/verify-package-ai`, {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setAiResult(result.data); // result.data now includes imageUrl
        setMessage(`AI Analysis: ${result.message}`);
      } else {
        setMessage(`AI Analysis failed: ${result.message || 'An unknown error occurred.'}`);
        setAiResult(null);
      }
    } catch (error) {
      console.error('Error during AI verification:', error);
      setMessage('Network error or backend is unreachable for AI verification. Please try again.');
      setAiResult(null);
    } finally {
      setIsUploading(false);
      setSelectedFile(null);
    }
  };

  // --- Admin Functions ---

  const handleAdminLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage('Logging in as admin...');
    try {
      // Call backend to get admin session key
      const response = await fetch(`${API_BASE_URL}/admin-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: adminUsername, password: adminPassword })
      });
      const result = await response.json();

      if (response.ok && result.success && result.adminKey) {
        setIsAdminLoggedIn(true);
        setAdminSessionKey(result.adminKey); // Store the key for future requests
        setCurrentPage('admin-dashboard');
        setMessage('Admin login successful!');
      } else {
        setMessage(`Login failed: ${result.message || 'Invalid credentials.'}`);
      }
    } catch (error) {
      console.error('Error during admin login:', error);
      setMessage('Network error during admin login. Check backend URL and ensure backend is running.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegisterManufacturer = async (e) => {
    e.preventDefault();
    if (!isAdminLoggedIn || !adminSessionKey) {
      setMessage('Admin not logged in.');
      return;
    }
    setIsLoading(true);
    setMessage('Registering manufacturer...');
    try {
      const response = await fetch(`${API_BASE_URL}/register-manufacturer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Key': adminSessionKey // Send custom admin key
        },
        body: JSON.stringify(newManufacturer)
      });
      const result = await response.json();
      if (response.ok && result.success) {
        setMessage(`Manufacturer "${newManufacturer.name}" registered successfully!`);
        setNewManufacturer({ id: '', name: '', location: '', contact: '' });
        fetchManufacturers(); // Refresh list
      } else {
        setMessage(`Failed to register manufacturer: ${result.message || 'Unknown error.'}`);
      }
    } catch (error) {
      console.error('Error registering manufacturer:', error);
      setMessage('Network error during manufacturer registration. Check backend.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegisterDrug = async (e) => {
    e.preventDefault();
    if (!isAdminLoggedIn || !adminSessionKey) {
      setMessage('Admin not logged in.');
      return;
    }
    setIsLoading(true);
    setMessage('Registering drug...');
    try {
      const response = await fetch(`${API_BASE_URL}/register-drug`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Key': adminSessionKey // Send custom admin key
        },
        body: JSON.stringify(newDrug)
      });
      const result = await response.json();
      if (response.ok && result.success) {
        setMessage(`Drug "${newDrug.drugName}" registered successfully!`);
        setNewDrug({ qrCode: '', drugName: '', manufacturer: '', batchNumber: '', expiryDate: '', description: '' });
        fetchRegisteredDrugs(); // Refresh list
      } else {
        setMessage(`Failed to register drug: ${result.message || 'Unknown error.'}`);
      }
    } catch (error) {
      console.error('Error registering drug:', error);
      setMessage('Network error during drug registration. Check backend.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAdminLogout = () => {
    setIsAdminLoggedIn(false);
    setAdminSessionKey(null);
    setAdminUsername('');
    setAdminPassword('');
    setCurrentPage('verify'); // Redirect to public page on logout
    setMessage('You are logged out.');
  };

  // --- NEW FEATURE FUNCTIONS ---

  // Fetch scan history from Supabase backend
  const fetchScanHistory = async () => {
    setIsLoading(true);
    setMessage('Fetching scan history...');
    try {
      // For now, using a hardcoded user ID. In a full auth system, this would be dynamic.
      const response = await fetch(`${API_BASE_URL}/get-scan-history?userId=public_user_id`);
      const result = await response.json();
      if (response.ok && result.success) {
        setScanHistory(result.data);
        setMessage('Scan history loaded.');
      } else {
        setScanHistory([]); // Clear history on failure
        setMessage(`Failed to load scan history: ${result.message}`);
      }
    } catch (error) {
      console.error('Error fetching scan history:', error);
      setMessage('Network error while fetching scan history. Check backend.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle counterfeit report submission
  const handleReportCounterfeit = async (e) => {
    e.preventDefault();
    if (!reportCounterfeitData.qrCode && !reportCounterfeitData.description) {
      setMessage('Please fill in at least QR Code or Description for the report.');
      return;
    }

    setIsLoading(true);
    setMessage('Submitting counterfeit report...');

    try {
      const response = await fetch(`${API_BASE_URL}/report-counterfeit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(reportCounterfeitData),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setMessage(`Counterfeit report submitted successfully! ${result.message || ''}`);
        setReportCounterfeitData({ qrCode: '', description: '', contact: '' }); // Clear form
      } else {
        setMessage(`Failed to submit report: ${result.message || 'An unknown error occurred.'}`);
      }
    } catch (error) {
      console.error('Error submitting counterfeit report:', error);
      setMessage('Network error or backend is unreachable for reporting. Please try again.');
    } finally {
      setIsLoading(false);
      setTimeout(() => {
          setMessage('Point your camera at a drug\'s QR code or enter it manually.');
      }, 5000);
    }
  };

  // NEW: Fetch notifications from backend
  const fetchNotifications = async () => {
    setIsLoading(true);
    setMessage('Fetching notifications...');
    try {
      // For now, using a hardcoded user ID. In a full auth system, this would be dynamic.
      const response = await fetch(`${API_BASE_URL}/get-notifications?userId=public_user_id`);
      const result = await response.json();
      if (response.ok && result.success) {
        setNotifications(result.data);
        const unreadCount = result.data.filter(n => !n.is_read).length;
        setUnreadNotificationCount(unreadCount);
        setMessage('Notifications loaded.');
      } else {
        setNotifications([]);
        setUnreadNotificationCount(0);
        setMessage(`Failed to load notifications: ${result.message || 'None found or error.'}`);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
      setMessage('Network error while fetching notifications. Check backend.');
    } finally {
      setIsLoading(false);
    }
  };

  // NEW: Mark a notification as read (frontend only for now, could be backend API)
  const markNotificationAsRead = (id) => {
    setNotifications(prevNotifications =>
      prevNotifications.map(n =>
        n.id === id ? { ...n, is_read: true } : n
      )
    );
    setUnreadNotificationCount(prevCount => Math.max(0, prevCount - 1));
    setMessage('Notification marked as read.');
  };


  // --- Effects ---
  useEffect(() => {
    if (isAdminLoggedIn) {
      if (currentPage === 'view-manufacturers') {
        fetchManufacturers();
      } else if (currentPage === 'view-drugs') {
        fetchRegisteredDrugs();
      } else if (currentPage === 'view-expiring-drugs') {
        fetchExpiringDrugs(expiryThresholdDays);
      }
    }
  }, [currentPage, isAdminLoggedIn, adminSessionKey, expiryThresholdDays]);

  // Effect to load scan history from Supabase on component mount or page change to scan-history
  useEffect(() => {
    if (currentPage === 'scan-history') {
      fetchScanHistory();
    }
  }, [currentPage]);

  // NEW: Effect to load notifications when component mounts or page changes to notifications
  useEffect(() => {
    if (currentPage === 'notifications') {
      fetchNotifications();
    }
  }, [currentPage]);

  // --- Render Logic based on currentPage ---

  const renderContent = () => {
    switch (currentPage) {
      case 'verify':
        return (
          <>
            {/* QR Scanner Section */}
            <section className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-lg md:max-w-2xl mb-8 border-b-4 border-green-500">
              <h2 className="text-2xl font-semibold text-gray-800 mb-4 text-center">Scan Drug QR Code</h2>
              {/* Updated QR Reader Container for responsive aspect ratio */}
              <div className="relative w-full overflow-hidden rounded-lg mb-4 border-2 border-dashed border-gray-400" style={{ paddingTop: '56.25%' /* 16:9 Aspect Ratio (height / width * 100%) */ }}>
                {!cameraError ? (
                  <div className="absolute top-0 left-0 w-full h-full">
                    <QrReader
                      onResult={handleQrReaderResult}
                      onError={handleError}
                      constraints={{ facingMode: facingMode }}
                      scanDelay={500}
                      videoContainerStyle={{ width: '100%', height: '100%', padding: '0px' }}
                      videoStyle={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  </div>
                ) : (
                  <div className="absolute top-0 left-0 w-full h-full flex flex-col items-center justify-center bg-gray-200 text-red-600 text-center p-4">
                      <p className="font-bold text-xl mb-2">Camera Not Available!</p>
                      <p className="text-sm">{cameraError}</p>
                      <p className="mt-2 text-sm">Please allow camera access or try opening this page in a standard browser tab outside of Replit's webview.</p>
                      <p className="mt-2 text-sm font-semibold">You can still use manual QR input below.</p>
                  </div>
                )}
                {/* Visual scanning overlay */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-3/4 h-3/4 border-4 border-green-400 rounded-lg opacity-70"></div>
                </div>
              </div>

              <button
                onClick={toggleCamera}
                className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-4 rounded-lg transition duration-300 ease-in-out shadow-md mb-4"
              >
                Switch Camera (Current: {facingMode === 'environment' ? 'Back' : 'Front'})
              </button>

              {scanResult && (
                <div className="bg-gray-100 p-4 rounded-lg mt-4 shadow-inner">
                  <p className="text-gray-800 font-semibold">Last Scanned QR Code:</p>
                  <p className="text-gray-600 break-words">{scanResult}</p>
                </div>
              )}

              <div className="mb-4">
                <label htmlFor="manualQr" className="block text-gray-700 text-lg font-semibold mb-2">
                  Or Enter QR Code Manually:
                </label>
                <input
                  type="text"
                  id="manualQr"
                  className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="e.g., MEDIVERIFY-DRUG-XYZ-789"
                  value={manualQrInput}
                  onChange={(e) => setManualQrInput(e.target.value)}
                />
              </div>
              <button
                onClick={() => handleVerify(manualQrInput)}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-lg transition duration-300 ease-in-out shadow-md"
                disabled={isLoading || !manualQrInput}
              >
                {isLoading && !aiResult ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Verifying...
                  </span>
                ) : (
                  'Verify QR Code'
                )}
              </button>
            </section>

            {/* AI Package Verification Section */}
            <section className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-lg md:max-w-2xl mb-8 border-b-4 border-purple-500">
              <h2 className="text-2xl font-semibold text-gray-800 mb-4 text-center">AI Visual Package Verification</h2>
              <p className="text-gray-600 text-center mb-4">
                Upload an image of the drug package for AI-powered authenticity analysis (simulated).
              </p>
              <div className="mb-4">
                <label htmlFor="packageImage" className="block text-gray-700 text-lg font-semibold mb-2">
                  Select Package Image:
                </label>
                <input
                  type="file"
                  id="packageImage"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100 cursor-pointer"
                />
                {selectedFile && (
                  <p className="mt-2 text-gray-600 text-sm">Selected: <span className="font-medium">{selectedFile.name}</span></p>
                )}
              </div>
              <button
                onClick={verifyPackageAI}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-4 rounded-lg transition duration-300 ease-in-out shadow-md"
                disabled={isUploading || !selectedFile}
              >
                {isUploading ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Analyzing...
                  </span>
                ) : (
                  'Analyze Package with AI'
                )}
              </button>
              {aiResult && (
                <div className="mt-4 p-4 bg-purple-50 rounded-lg border border-purple-200">
                  <h3 className="text-lg font-bold text-purple-800 mb-2">AI Analysis Result:</h3>
                  {aiResult.imageUrl && (
                    <div className="mb-3">
                      <img src={aiResult.imageUrl} alt="Uploaded Package" className="max-w-full h-auto rounded-lg shadow-md mx-auto" />
                      <p className="text-center text-sm text-gray-500 mt-1">Uploaded Image</p>
                    </div>
                  )}
                  <p className="text-base text-purple-700">
                    Authenticity: <span className={`font-bold ${aiResult.authenticity.toLowerCase().includes('authentic') ? 'text-green-700' : 'text-red-700'}`}>{aiResult.authenticity.toUpperCase()}</span>
                  </p>
                  <p className="text-base text-purple-700">
                    Confidence: {Math.round(aiResult.confidence * 100)}%
                  </p>
                  <p className="text-base text-purple-700">
                    Details: {aiResult.details}
                  </p>
                </div>
              )}
            </section>

            {/* Verification Data Display */}
            {verificationData && (
              <section className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-lg md:max-w-2xl mb-8 border-b-4 border-blue-500">
                <h2 className="text-2xl font-bold text-blue-700 mb-4 text-center">Drug Details & Supply Chain</h2>
                {verificationData.isRecalled && (
                    <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg relative mb-4" role="alert">
                        <strong className="font-bold">URGENT RECALL!</strong>
                        <span className="block sm:inline ml-2">This drug batch has been recalled. Do NOT use.</span>
                    </div>
                )}
                {verificationData.expirySoon && (
                    <div className="bg-orange-100 border border-orange-400 text-orange-700 px-4 py-3 rounded-lg relative mb-4" role="alert">
                        <strong className="font-bold">EXPIRY ALERT!</strong>
                        <span className="block sm:inline ml-2">This drug is expiring soon (within {expiryThresholdDays} days).</span>
                    </div>
                )}
                <p className="text-gray-600 text-center mb-4">
                  Information retrieved from the secure blockchain ledger.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-gray-800">
                  <p><span className="font-semibold">QR Code:</span> {verificationData.qrCode}</p>
                  <p><span className="font-semibold">Drug Name:</span> {verificationData.drugName}</p>
                  <p><span className="font-semibold">Manufacturer:</span> {verificationData.manufacturer}</p>
                  <p><span className="font-semibold">Batch Number:</span> {verificationData.batchNumber}</p>
                  <p><span className="font-semibold">Expiry Date:</span> {verificationData.expiryDate}</p>
                  <p>
                    <span className="font-semibold">Status:</span>{' '}
                    <span className={`font-bold ${verificationData.status.toLowerCase().includes('authentic') ? 'text-green-600' : 'text-red-600'}`}>
                      {verificationData.status.toUpperCase()}
                    </span>
                  </p>
                  <p className="col-span-full"><span className="font-semibold">Description:</span> {verificationData.description}</p>
                </div>

                <h3 className="text-xl font-semibold text-gray-800 mt-6 mb-3">Supply Chain Traceability:</h3>
                <p className="text-gray-600 mb-4">
                  Track the journey of this drug from manufacturing to distribution, ensuring transparency and security.
                </p>
                {verificationData.supplyChain && verificationData.supplyChain.length > 0 ? (
                  <ul className="list-disc list-inside text-gray-700 ml-4">
                    {verificationData.supplyChain.map((step, index) => (
                      <li key={index} className="mb-1">{step}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-gray-600 ml-4">No detailed supply chain steps recorded for this drug.</p>
                )}
              </section>
            )}
          </>
        );

      case 'scan-history':
        return (
          <section className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-lg md:max-w-2xl mb-8 border-b-4 border-yellow-500">
            <h2 className="text-2xl font-semibold text-gray-800 mb-4 text-center">Your Scan History</h2>
            {scanHistory.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full bg-white border border-gray-200 rounded-lg">
                  <thead>
                    <tr className="bg-gray-100 text-left text-gray-600 uppercase text-sm leading-normal">
                      <th className="py-3 px-6 border-b border-gray-200">Time</th>
                      <th className="py-3 px-6 border-b border-gray-200">QR Code</th>
                      <th className="py-3 px-6 border-b border-gray-200">Drug Name</th>
                      <th className="py-3 px-6 border-b border-gray-200">Status</th>
                      <th className="py-3 px-6 border-b border-gray-200">Recall</th>
                      <th className="py-3 px-6 border-b border-gray-200">Expiring Soon</th>
                    </tr>
                  </thead>
                  <tbody className="text-gray-700 text-sm font-light">
                    {scanHistory.map((scan) => (
                      <tr key={scan.id} className="border-b border-gray-200 hover:bg-gray-50">
                        <td className="py-3 px-6 text-left whitespace-nowrap">{scan.scanned_at ? new Date(scan.scanned_at).toLocaleString() : 'N/A'}</td>
                        <td className="py-3 px-6 text-left break-all">{scan.qr_code}</td>
                        <td className="py-3 px-6 text-left">{scan.drug_name || 'N/A'}</td>
                        <td className="py-3 px-6 text-left">
                          <span className={`font-bold ${scan.status.toLowerCase().includes('authentic') ? 'text-green-600' : 'text-red-600'}`}>
                            {scan.status.toUpperCase()}
                          </span>
                        </td>
                         <td className="py-3 px-6 text-left">
                            {scan.is_recalled ? <span className="text-red-600 font-bold">YES</span> : 'No'}
                        </td>
                        <td className="py-3 px-6 text-left">
                            {scan.expiry_date && isExpiringSoon(scan.expiry_date) ? <span className="text-orange-600 font-bold">YES</span> : 'No'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-gray-600 text-center">No scan history yet. Verify a drug to see it here!</p>
            )}
            <button
              onClick={() => setCurrentPage('verify')}
              className="mt-6 w-full bg-gray-500 hover:bg-gray-600 text-white font-bold py-3 px-4 rounded-lg transition duration-300 ease-in-out shadow-md"
            >
              Back to Verification
            </button>
          </section>
        );

      case 'report-counterfeit':
        return (
          <section className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-lg md:max-w-xl mb-8 border-b-4 border-red-500">
            <h2 className="text-2xl font-semibold text-gray-800 mb-4 text-center">Report Suspected Counterfeit</h2>
            <p className="text-gray-600 text-center mb-6">Help us fight fake drugs by reporting suspicious products.</p>
            <form onSubmit={handleReportCounterfeit}>
              <div className="mb-4">
                <label htmlFor="reportQrCode" className="block text-gray-700 text-lg font-semibold mb-2">QR Code (if available):</label>
                <input
                  type="text"
                  id="reportQrCode"
                  className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                  placeholder="e.g., MEDIVERIFY-DRUG-XYZ-789"
                  value={reportCounterfeitData.qrCode}
                  onChange={(e) => setReportCounterfeitData({ ...reportCounterfeitData, qrCode: e.target.value })}
                />
              </div>
              <div className="mb-4">
                <label htmlFor="reportDescription" className="block text-gray-700 text-lg font-semibold mb-2">Description of Suspicion:</label>
                <textarea
                  id="reportDescription"
                  className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                  rows="4"
                  placeholder="e.g., Packaging looks off, unusual smell, no effect after taking."
                  value={reportCounterfeitData.description}
                  onChange={(e) => setReportCounterfeitData({ ...reportCounterfeitData, description: e.target.value })}
                  required
                ></textarea>
              </div>
              <div className="mb-6">
                <label htmlFor="reportContact" className="block text-gray-700 text-lg font-semibold mb-2">Your Contact Info (Optional):</label>
                <input
                  type="text"
                  id="reportContact"
                  className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                  placeholder="Email or Phone (e.g., your@example.com)"
                  value={reportCounterfeitData.contact}
                  onChange={(e) => setReportCounterfeitData({ ...reportCounterfeitData, contact: e.target.value })}
                />
              </div>
              <button
                type="submit"
                className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-4 rounded-lg transition duration-300 ease-in-out shadow-md"
                disabled={isLoading}
              >
                {isLoading ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Submitting...
                  </span>
                ) : (
                  'Submit Report'
                )}
              </button>
            </form>
            <button
              onClick={() => setCurrentPage('verify')}
              className="mt-4 w-full bg-gray-500 hover:bg-gray-600 text-white font-bold py-3 px-4 rounded-lg transition duration-300 ease-in-out shadow-md"
            >
              Back to Verification
            </button>
          </section>
        );

      case 'notifications':
        return (
          <section className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-lg md:max-w-2xl mb-8 border-b-4 border-blue-500">
            <h2 className="text-2xl font-semibold text-gray-800 mb-4 text-center">Notifications</h2>
            {notifications.length > 0 ? (
              <div className="space-y-4">
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`p-4 rounded-lg shadow-sm flex items-start space-x-3 ${
                      notification.is_read ? 'bg-gray-100 text-gray-700' : 'bg-blue-50 text-blue-900 font-semibold border border-blue-200'
                    }`}
                  >
                    <div className="flex-shrink-0">
                      {notification.type === 'recall_alert' && (
                        <svg className="h-6 w-6 text-red-500" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd"></path></svg>
                      )}
                      {/* Add icons for other notification types here */}
                    </div>
                    <div className="flex-grow">
                      <p className="text-sm">{notification.message}</p>
                      {notification.related_qr_code && (
                        <p className="text-xs text-gray-500 mt-1">QR: {notification.related_qr_code}</p>
                      )}
                      <p className="text-xs text-gray-500 mt-1">
                        {new Date(notification.created_at).toLocaleString()}
                      </p>
                    </div>
                    {!notification.is_read && (
                      <button
                        onClick={() => markNotificationAsRead(notification.id)}
                        className="flex-shrink-0 ml-4 px-3 py-1 bg-white text-blue-600 border border-blue-600 rounded-full text-xs font-semibold hover:bg-blue-100 transition duration-200"
                      >
                        Mark as Read
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-600 text-center">No new notifications.</p>
            )}
            <button
              onClick={() => setCurrentPage('verify')}
              className="mt-6 w-full bg-gray-500 hover:bg-gray-600 text-white font-bold py-3 px-4 rounded-lg transition duration-300 ease-in-out shadow-md"
            >
              Back to Verification
            </button>
          </section>
        );

      case 'admin-login':
        return (
          <section className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-lg md:max-w-xl mb-8 border-b-4 border-orange-500">
            <h2 className="text-2xl font-semibold text-gray-800 mb-4 text-center">Admin Login</h2>
            <form onSubmit={handleAdminLogin}>
              <div className="mb-4">
                <label htmlFor="username" className="block text-gray-700 text-lg font-semibold mb-2">Username:</label>
                <input
                  type="text"
                  id="username"
                  className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                  value={adminUsername}
                  onChange={(e) => setAdminUsername(e.target.value)}
                  required
                />
              </div>
              <div className="mb-6">
                <label htmlFor="password" className="block text-gray-700 text-lg font-semibold mb-2">Password:</label>
                <input
                  type="password"
                  id="password"
                  className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  required
                />
              </div>
              <button
                type="submit"
                className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 px-4 rounded-lg transition duration-300 ease-in-out shadow-md"
              >
                Login
              </button>
            </form>
          </section>
        );

      case 'admin-dashboard':
        return (
          <section className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-lg md:max-w-xl mb-8 border-b-4 border-teal-500">
            <h2 className="text-2xl font-semibold text-gray-800 mb-4 text-center">Admin Dashboard</h2>
            <p className="text-gray-600 text-center mb-6">Manage manufacturers and drug registrations.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button
                onClick={() => setCurrentPage('register-manufacturer')}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg transition duration-300 ease-in-out shadow-md"
              >
                Register Manufacturer
              </button>
              <button
                onClick={() => setCurrentPage('register-drug')}
                className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-lg transition duration-300 ease-in-out shadow-md"
              >
                Register Drug
              </button>
              <button
                onClick={() => setCurrentPage('view-manufacturers')}
                className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-4 rounded-lg transition duration-300 ease-in-out shadow-md"
              >
                View Manufacturers
              </button>
              <button
                onClick={() => setCurrentPage('view-drugs')}
                className="bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-4 rounded-lg transition duration-300 ease-in-out shadow-md"
              >
                View Registered Drugs
              </button>
              <button
                onClick={() => setCurrentPage('view-expiring-drugs')}
                className="bg-orange-600 hover:bg-orange-700 text-white font-bold py-3 px-4 rounded-lg transition duration-300 ease-in-out shadow-md col-span-full"
              >
                View Expiring Drugs
              </button>
            </div>
            <button
              onClick={handleAdminLogout}
              className="mt-6 w-full bg-gray-500 hover:bg-gray-600 text-white font-bold py-3 px-4 rounded-lg transition duration-300 ease-in-out shadow-md"
            >
              Logout
            </button>
          </section>
        );

      case 'register-manufacturer':
        return (
          <section className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-lg md:max-w-xl mb-8 border-b-4 border-blue-500">
            <h2 className="text-2xl font-semibold text-gray-800 mb-4 text-center">Register New Manufacturer</h2>
            <form onSubmit={handleRegisterManufacturer}>
              <div className="mb-4">
                <label htmlFor="mfrId" className="block text-gray-700 text-lg font-semibold mb-2">Manufacturer ID:</label>
                <input
                  type="text"
                  id="mfrId"
                  className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={newManufacturer.id}
                  onChange={(e) => setNewManufacturer({ ...newManufacturer, id: e.target.value })}
                  required
                />
              </div>
              <div className="mb-4">
                <label htmlFor="mfrName" className="block text-gray-700 text-lg font-semibold mb-2">Manufacturer Name:</label>
                <input
                  type="text"
                  id="mfrName"
                  className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={newManufacturer.name}
                  onChange={(e) => setNewManufacturer({ ...newManufacturer, name: e.target.value })}
                  required
                />
              </div>
              <div className="mb-4">
                <label htmlFor="mfrLocation" className="block text-gray-700 text-lg font-semibold mb-2">Location:</label>
                <input
                  type="text"
                  id="mfrLocation"
                  className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={newManufacturer.location}
                  onChange={(e) => setNewManufacturer({ ...newManufacturer, location: e.target.value })}
                  required
                />
              </div>
              <div className="mb-6">
                <label htmlFor="mfrContact" className="block text-gray-700 text-lg font-semibold mb-2">Contact Info:</label>
                <input
                  type="text"
                  id="mfrContact"
                  className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={newManufacturer.contact}
                  onChange={(e) => setNewManufacturer({ ...newManufacturer, contact: e.target.value })}
                />
              </div>
              <button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg transition duration-300 ease-in-out shadow-md"
                disabled={isLoading}
              >
                {isLoading ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Registering...
                  </span>
                ) : (
                  'Register Manufacturer'
                )}
              </button>
            </form>
            <button
              onClick={() => setCurrentPage('admin-dashboard')}
              className="mt-4 w-full bg-gray-500 hover:bg-gray-600 text-white font-bold py-3 px-4 rounded-lg transition duration-300 ease-in-out shadow-md"
            >
              Back to Dashboard
            </button>
          </section>
        );

      case 'register-drug':
        return (
          <section className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-lg md:max-w-xl mb-8 border-b-4 border-green-500">
            <h2 className="text-2xl font-semibold text-gray-800 mb-4 text-center">Register New Drug</h2>
            <form onSubmit={handleRegisterDrug}>
              <div className="mb-4">
                <label htmlFor="drugQrCode" className="block text-gray-700 text-lg font-semibold mb-2">QR Code:</label>
                <input
                  type="text"
                  id="drugQrCode"
                  className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  value={newDrug.qrCode}
                  onChange={(e) => setNewDrug({ ...newDrug, qrCode: e.target.value })}
                  required
                />
              </div>
              <div className="mb-4">
                <label htmlFor="drugName" className="block text-gray-700 text-lg font-semibold mb-2">Drug Name:</label>
                <input
                  type="text"
                  id="drugName"
                  className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  value={newDrug.drugName}
                  onChange={(e) => setNewDrug({ ...newDrug, drugName: e.target.value })}
                  required
                />
              </div>
              <div className="mb-4">
                <label htmlFor="drugManufacturer" className="block text-gray-700 text-lg font-semibold mb-2">Manufacturer ID:</label>
                <input
                  type="text"
                  id="drugManufacturer"
                  className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="e.g., MFR001 (must be an existing manufacturer ID)"
                  value={newDrug.manufacturer}
                  onChange={(e) => setNewDrug({ ...newDrug, manufacturer: e.target.value })}
                  required
                />
              </div>
              <div className="mb-4">
                <label htmlFor="drugBatch" className="block text-gray-700 text-lg font-semibold mb-2">Batch Number:</label>
                <input
                  type="text"
                  id="drugBatch"
                  className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  value={newDrug.batchNumber}
                  onChange={(e) => setNewDrug({ ...newDrug, batchNumber: e.target.value })}
                  required
                />
              </div>
              <div className="mb-4">
                <label htmlFor="drugExpiry" className="block text-gray-700 text-lg font-semibold mb-2">Expiry Date (YYYY-MM-DD):</label>
                <input
                  type="date"
                  id="drugExpiry"
                  className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  value={newDrug.expiryDate}
                  onChange={(e) => setNewDrug({ ...newDrug, expiryDate: e.target.value })}
                  required
                />
              </div>
              <div className="mb-6">
                <label htmlFor="drugDescription" className="block text-gray-700 text-lg font-semibold mb-2">Description:</label>
                <textarea
                  id="drugDescription"
                  className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  rows="3"
                  value={newDrug.description}
                  onChange={(e) => setNewDrug({ ...newDrug, description: e.target.value })}
                ></textarea>
              </div>
              <button
                type="submit"
                className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-lg transition duration-300 ease-in-out shadow-md"
                disabled={isLoading}
              >
                {isLoading ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Registering...
                  </span>
                ) : (
                  'Register Drug'
                )}
              </button>
            </form>
            <button
              onClick={() => setCurrentPage('admin-dashboard')}
              className="mt-4 w-full bg-gray-500 hover:bg-gray-600 text-white font-bold py-3 px-4 rounded-lg transition duration-300 ease-in-out shadow-md"
            >
              Back to Dashboard
            </button>
          </section>
        );

      case 'view-manufacturers':
        return (
          <section className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-lg md:max-w-2xl mb-8 border-b-4 border-purple-500">
            <h2 className="text-2xl font-semibold text-gray-800 mb-4 text-center">Registered Manufacturers</h2>
            {manufacturers.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full bg-white border border-gray-200 rounded-lg">
                  <thead>
                    <tr className="bg-gray-100 text-left text-gray-600 uppercase text-sm leading-normal">
                      <th className="py-3 px-6 border-b border-gray-200">ID</th>
                      <th className="py-3 px-6 border-b border-gray-200">Name</th>
                      <th className="py-3 px-6 border-b border-gray-200">Location</th>
                      <th className="py-3 px-6 border-b border-gray-200">Contact</th>
                    </tr>
                  </thead>
                  <tbody className="text-gray-700 text-sm font-light">
                    {manufacturers.map((mfr) => (
                      <tr key={mfr.id} className="border-b border-gray-200 hover:bg-gray-50">
                        <td className="py-3 px-6 text-left whitespace-nowrap">{mfr.id}</td>
                        <td className="py-3 px-6 text-left">{mfr.name}</td>
                        <td className="py-3 px-6 text-left">{mfr.location}</td>
                        <td className="py-3 px-6 text-left">{mfr.contact || 'N/A'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-gray-600 text-center">No manufacturers registered yet.</p>
            )}
            <button
              onClick={() => setCurrentPage('admin-dashboard')}
              className="mt-6 w-full bg-gray-500 hover:bg-gray-600 text-white font-bold py-3 px-4 rounded-lg transition duration-300 ease-in-out shadow-md"
            >
              Back to Dashboard
            </button>
          </section>
        );

      case 'view-drugs':
        return (
          <section className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-lg md:max-w-2xl mb-8 border-b-4 border-red-500">
            <h2 className="text-2xl font-semibold text-gray-800 mb-4 text-center">Registered Drugs</h2>
            {registeredDrugs.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full bg-white border border-gray-200 rounded-lg">
                  <thead>
                    <tr className="bg-gray-100 text-left text-gray-600 uppercase text-sm leading-normal">
                      <th className="py-3 px-6 border-b border-gray-200">QR Code</th>
                      <th className="py-3 px-6 border-b border-gray-200">Drug Name</th>
                      <th className="py-3 px-6 border-b border-gray-200">Manufacturer ID</th>
                      <th className="py-3 px-6 border-b border-gray-200">Batch</th>
                      <th className="py-3 px-6 border-b border-gray-200">Expiry</th>
                      <th className="py-3 px-6 border-b border-gray-200">Status</th>
                    </tr>
                  </thead>
                  <tbody className="text-gray-700 text-sm font-light">
                    {registeredDrugs.map((drug, index) => (
                      <tr key={index} className="border-b border-gray-200 hover:bg-gray-50">
                        <td className="py-3 px-6 text-left whitespace-nowrap">{drug.qr_code}</td>
                        <td className="py-3 px-6 text-left">{drug.drug_name}</td>
                        <td className="py-3 px-6 text-left">{drug.manufacturer_id}</td>
                        <td className="py-3 px-6 text-left">{drug.batch_number}</td>
                        <td className="py-3 px-6 text-left">{drug.expiry_date}</td>
                        <td className="py-3 px-6 text-left">
                          <span className={`font-bold ${drug.status.toLowerCase().includes('authentic') ? 'text-green-600' : 'text-red-600'}`}>
                            {drug.status.toUpperCase()}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-gray-600 text-center">No drugs registered yet.</p>
            )}
            <button
              onClick={() => setCurrentPage('admin-dashboard')}
              className="mt-6 w-full bg-gray-500 hover:bg-gray-600 text-white font-bold py-3 px-4 rounded-lg transition duration-300 ease-in-out shadow-md"
            >
              Back to Dashboard
            </button>
          </section>
        );

        case 'view-expiring-drugs':
            return (
              <section className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-lg md:max-w-2xl mb-8 border-b-4 border-orange-500">
                <h2 className="text-2xl font-semibold text-gray-800 mb-4 text-center">Drugs Expiring Soon</h2>
                <div className="mb-4 flex items-center justify-center space-x-2">
                    <label htmlFor="expiryDays" className="text-gray-700 font-semibold">Expiring within (days):</label>
                    <input
                        type="number"
                        id="expiryDays"
                        min="1"
                        className="w-20 p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-center"
                        value={expiryThresholdDays}
                        onChange={(e) => setExpiryThresholdDays(parseInt(e.target.value) || 0)}
                    />
                    <button
                        onClick={() => fetchExpiringDrugs(expiryThresholdDays)}
                        className="bg-orange-500 hover:bg-orange-600 text-white font-bold py-2 px-4 rounded-lg transition duration-300 ease-in-out shadow-md"
                    >
                        Filter
                    </button>
                </div>
                {expiringDrugs.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="min-w-full bg-white border border-gray-200 rounded-lg">
                      <thead>
                        <tr className="bg-gray-100 text-left text-gray-600 uppercase text-sm leading-normal">
                          <th className="py-3 px-6 border-b border-gray-200">QR Code</th>
                          <th className="py-3 px-6 border-b border-gray-200">Drug Name</th>
                          <th className="py-3 px-6 border-b border-gray-200">Manufacturer ID</th>
                          <th className="py-3 px-6 border-b border-gray-200">Expiry Date</th>
                        </tr>
                      </thead>
                      <tbody className="text-gray-700 text-sm font-light">
                        {expiringDrugs.map((drug, index) => (
                          <tr key={index} className="border-b border-gray-200 hover:bg-gray-50">
                            <td className="py-3 px-6 text-left whitespace-nowrap">{drug.qr_code}</td>
                            <td className="py-3 px-6 text-left">{drug.drug_name}</td>
                            <td className="py-3 px-6 text-left">{drug.manufacturer_id}</td>
                            <td className="py-3 px-6 text-left font-bold text-orange-700">{drug.expiry_date}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-gray-600 text-center">No drugs found expiring within {expiryThresholdDays} days.</p>
                )}
                <button
                  onClick={() => setCurrentPage('admin-dashboard')}
                  className="mt-6 w-full bg-gray-500 hover:bg-gray-600 text-white font-bold py-3 px-4 rounded-lg transition duration-300 ease-in-out shadow-md"
                >
                  Back to Dashboard
                </button>
              </section>
            );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-100 flex flex-col items-center justify-center p-4 w-full md:max-w-4xl mx-auto font-inter">
      {/* Header Section */}
      <header className="w-full text-center mb-8">
        <h1 className="text-4xl font-extrabold text-green-700 mb-2 rounded-lg p-2 shadow-md bg-white">
          MediVerify
        </h1>
        <p className="text-lg text-gray-600">
          Authenticating Medicines, Ensuring Patient Safety.
        </p>
      </header>

      {/* Navigation Buttons */}
      <nav className="w-full flex flex-wrap justify-center gap-2 mb-8">
        <button
          onClick={() => setCurrentPage('verify')}
          className={`px-4 py-2 rounded-lg font-semibold transition duration-300 ease-in-out shadow-sm ${
            currentPage === 'verify' ? 'bg-green-700 text-white' : 'bg-white text-green-700 hover:bg-green-50'
          }`}
        >
          Verify Drug
        </button>
        <button
          onClick={() => setCurrentPage('scan-history')}
          className={`px-4 py-2 rounded-lg font-semibold transition duration-300 ease-in-out shadow-sm ${
            currentPage === 'scan-history' ? 'bg-yellow-700 text-white' : 'bg-white text-yellow-700 hover:bg-yellow-50'
          }`}
        >
          Scan History
        </button>
        <button
          onClick={() => setCurrentPage('report-counterfeit')}
          className={`px-4 py-2 rounded-lg font-semibold transition duration-300 ease-in-out shadow-sm ${
            currentPage === 'report-counterfeit' ? 'bg-red-700 text-white' : 'bg-white text-red-700 hover:bg-red-50'
          }`}
        >
          Report Counterfeit
        </button>
        <button
          onClick={() => setCurrentPage('notifications')}
          className={`relative px-4 py-2 rounded-lg font-semibold transition duration-300 ease-in-out shadow-sm ${
            currentPage === 'notifications' ? 'bg-blue-700 text-white' : 'bg-white text-blue-700 hover:bg-blue-50'
          }`}
        >
          Notifications
          {unreadNotificationCount > 0 && (
            <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
              {unreadNotificationCount}
            </span>
          )}
        </button>
        {!isAdminLoggedIn ? (
          <button
            onClick={() => setCurrentPage('admin-login')}
            className={`px-4 py-2 rounded-lg font-semibold transition duration-300 ease-in-out shadow-sm ${
              currentPage === 'admin-login' ? 'bg-orange-700 text-white' : 'bg-white text-orange-700 hover:bg-orange-50'
            }`}
          >
            Admin Login
          </button>
        ) : (
          <button
            onClick={() => setCurrentPage('admin-dashboard')}
            className={`px-4 py-2 rounded-lg font-semibold transition duration-300 ease-in-out shadow-sm ${
              currentPage.startsWith('admin') ? 'bg-teal-700 text-white' : 'bg-white text-teal-700 hover:bg-teal-50'
            }`}
          >
            Admin Dashboard
          </button>
        )}
      </nav>

      {/* Status Message Display */}
      <div className={`text-center text-lg font-semibold p-3 rounded-lg w-full mb-8 ${ // Removed max-w-lg here
          isLoading || isUploading ? 'bg-yellow-100 text-yellow-800' :
          message.includes('Error') || message.includes('failed') || message.includes('denied') || message.includes('Invalid') ? 'bg-red-100 text-red-800' :
          (verificationData || aiResult || message.includes('successful') || message.includes('registered')) ? 'bg-green-100 text-green-800' :
          'bg-gray-100 text-gray-700'
      }`}>
        {message}
      </div>

      {/* Render current page content */}
      {renderContent()}

      {/* Global Loading Overlay */}
      {(isLoading || isUploading) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl flex items-center">
            <svg className="animate-spin -ml-1 mr-3 h-8 w-8 text-green-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <p className="text-lg text-gray-700">Processing request...</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
