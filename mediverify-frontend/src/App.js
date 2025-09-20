import { QrReader } from 'react-qr-reader';
import React, { useState, useEffect, useCallback } from 'react';

function App() {
  // --- Core Verification States ---
  const [scanResult, setScanResult] = useState('');
  const [facingMode, setFacingMode] = useState('environment');
  const [message, setMessage] = useState('Point your camera at a drug\'s QR code or enter it manually.');
  const [verificationData, setVerificationData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [manualQrInput, setManualQrInput] = useState('');
  const [scanAttempts, setScanAttempts] = useState(0); // Track scan attempts

  // --- AI Verification States ---
  const [selectedFile, setSelectedFile] = useState(null);
  const [aiResult, setAiResult] = useState(null);
  const [isUploading, setIsUploading] = useState(false);

  // --- Navigation/Admin States ---
  const [currentPage, setCurrentPage] = useState('verify');
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [adminSessionKey, setAdminSessionKey] = useState(null);

  // --- Admin Data States ---
  const [manufacturers, setManufacturers] = useState([]);
  const [registeredDrugs, setRegisteredDrugs] = useState([]);
  const [newManufacturer, setNewManufacturer] = useState({ id: '', name: '', location: '', contact: '' });
  const [newDrug, setNewDrug] = useState({ qrCode: '', drugName: '', manufacturer: '', batchNumber: '', expiryDate: '', description: '' });

  // --- NEW FEATURE STATES ---
  const [scanHistory, setScanHistory] = useState([]);
  const [reportCounterfeitData, setReportCounterfeitData] = useState({ qrCode: '', description: '', contact: '' });
  const [expiringDrugs, setExpiringDrugs] = useState([]);
  const [expiryThresholdDays, setExpiryThresholdDays] = useState(90);
  const [notifications, setNotifications] = useState([]);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);

  const API_BASE_URL = 'https://07ecd53a-4463-400d-a252-37769a5e9e7f-00-1fva6us9oqckd.spock.replit.dev/api';

  const isExpiringSoon = (expiryDateString, days = 90) => {
    if (!expiryDateString) return false;
    const expiry = new Date(expiryDateString);
    const today = new Date();
    const futureDate = new Date();
    futureDate.setDate(today.getDate() + days);
    return expiry > today && expiry <= futureDate;
  };

  // --- Data Fetching Functions (Admin Only) ---
  const fetchManufacturers = useCallback(async () => {
    if (!isAdminLoggedIn || !adminSessionKey) return;
    setIsLoading(true);
    setMessage('Fetching manufacturers...');
    try {
      const response = await fetch(`${API_BASE_URL}/get-manufacturers`, {
        headers: { 'X-Admin-Key': adminSessionKey }
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
  }, [isAdminLoggedIn, adminSessionKey, API_BASE_URL]);

  const fetchRegisteredDrugs = useCallback(async () => {
    if (!isAdminLoggedIn || !adminSessionKey) return;
    setIsLoading(true);
    setMessage('Fetching registered drugs...');
    try {
      const response = await fetch(`${API_BASE_URL}/get-drugs`, {
        headers: { 'X-Admin-Key': adminSessionKey }
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
  }, [isAdminLoggedIn, adminSessionKey, API_BASE_URL]);

  const fetchExpiringDrugs = useCallback(async (days) => {
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
  }, [isAdminLoggedIn, adminSessionKey, API_BASE_URL]);

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
        const expirySoon = isExpiringSoon(result.data.expiryDate);
        const verifiedDataWithExpiry = { ...result.data, expirySoon };

        setVerificationData(verifiedDataWithExpiry);
        setMessage(`Verification successful: ${result.message}`);
        fetchScanHistory();
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
      // Reset scan attempts on successful scan
      setScanAttempts(0);
      setCameraError(null);
    }
    if (!!error) {
      if (error.name === "NotAllowedError") {
        setCameraError("Camera permission denied. Please allow camera access to scan QR codes.");
      } else if (error.name === "OverconstrainedError") {
        setCameraError("No suitable camera device found. Please try a different device or browser.");
      } else if (error.name === "NotFoundError") {
        setCameraError("No camera device found on this device.");
      } else {
        // Handle QR detection errors
        console.error('QR Reader specific error:', error);
        // Increment scan attempts
        setScanAttempts(prev => prev + 1);

        // After 3 failed attempts, show a helpful message
        if (scanAttempts >= 2) {
          setCameraError("Having trouble detecting the QR code? Please ensure good lighting, steady hand, and that the QR code is clearly visible. You can also try manual entry.");
        }
      }
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
    setCameraError(null);
    // Reset scan attempts when switching cameras
    setScanAttempts(0);
  };

  const resetScanner = () => {
    setScanResult('');
    setCameraError(null);
    setScanAttempts(0);
    setMessage('Point your camera at a drug\'s QR code or enter it manually.');
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
        setAiResult(result.data);
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
      const response = await fetch(`${API_BASE_URL}/admin-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: adminUsername, password: adminPassword })
      });
      const result = await response.json();

      if (response.ok && result.success && result.adminKey) {
        setIsAdminLoggedIn(true);
        setAdminSessionKey(result.adminKey);
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
          'X-Admin-Key': adminSessionKey
        },
        body: JSON.stringify(newManufacturer)
      });
      const result = await response.json();
      if (response.ok && result.success) {
        setMessage(`Manufacturer "${newManufacturer.name}" registered successfully!`);
        setNewManufacturer({ id: '', name: '', location: '', contact: '' });
        fetchManufacturers();
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
          'X-Admin-Key': adminSessionKey
        },
        body: JSON.stringify(newDrug)
      });
      const result = await response.json();
      if (response.ok && result.success) {
        setMessage(`Drug "${newDrug.drugName}" registered successfully!`);
        setNewDrug({ qrCode: '', drugName: '', manufacturer: '', batchNumber: '', expiryDate: '', description: '' });
        fetchRegisteredDrugs();
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
    setCurrentPage('verify');
    setMessage('You are logged out.');
  };

  // --- NEW FEATURE FUNCTIONS ---
  const fetchScanHistory = async () => {
    setIsLoading(true);
    setMessage('Fetching scan history...');
    try {
      const response = await fetch(`${API_BASE_URL}/get-scan-history?userId=public_user_id`);
      const result = await response.json();
      if (response.ok && result.success) {
        setScanHistory(result.data);
        setMessage('Scan history loaded.');
      } else {
        setScanHistory([]);
        setMessage(`Failed to load scan history: ${result.message}`);
      }
    } catch (error) {
      console.error('Error fetching scan history:', error);
      setMessage('Network error while fetching scan history. Check backend.');
    } finally {
      setIsLoading(false);
    }
  };

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
        setReportCounterfeitData({ qrCode: '', description: '', contact: '' });
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

  const fetchNotifications = async () => {
    setIsLoading(true);
    setMessage('Fetching notifications...');
    try {
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
  }, [currentPage, isAdminLoggedIn, adminSessionKey, expiryThresholdDays, 
      fetchManufacturers, fetchRegisteredDrugs, fetchExpiringDrugs]);

  useEffect(() => {
    if (currentPage === 'scan-history') {
      fetchScanHistory();
    }
  }, [currentPage]);

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

              {/* Scanner Tips */}
              <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-4 rounded">
                <p className="text-blue-700">
                  <strong>Scanning Tips:</strong> Ensure good lighting, hold steady, and position QR code within the frame. 
                  If scanning fails after multiple attempts, use manual entry below.
                </p>
              </div>

              {/* QR Scanner Container */}
              <div className="relative w-full overflow-hidden rounded-lg mb-4 border-2 border-dashed border-gray-400" style={{ paddingTop: '56.25%' }}>
                {!cameraError ? (
                  <div className="absolute top-0 left-0 w-full h-full">
                    <QrReader
                      onResult={handleQrReaderResult}
                      onError={handleError}
                      constraints={{ 
                        facingMode: facingMode,
                        width: { ideal: 1280 },
                        height: { ideal: 720 },
                        aspectRatio: { ideal: 1 }
                      }}
                      scanDelay={500}
                      videoContainerStyle={{ width: '100%', height: '100%', padding: '0px' }}
                      videoStyle={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                    {/* Scanning overlay */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="w-3/4 h-3/4 border-4 border-green-400 rounded-lg opacity-70"></div>
                      <div className="absolute top-0 left-0 right-0 text-center text-white bg-black bg-opacity-50 py-1">
                        Position QR code within the frame
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="absolute top-0 left-0 w-full h-full flex flex-col items-center justify-center bg-gray-200 text-red-600 text-center p-4">
                    <p className="font-bold text-xl mb-2">Camera Not Available!</p>
                    <p className="text-sm">{cameraError}</p>
                    <p className="mt-2 text-sm">Please allow camera access or try opening this page in a standard browser tab outside of Replit's webview.</p>
                    <p className="mt-2 text-sm font-semibold">You can still use manual QR input below.</p>
                  </div>
                )}
              </div>

              {/* Camera Controls */}
              <div className="flex gap-3 mb-4">
                <button
                  onClick={toggleCamera}
                  className="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-4 rounded-lg transition duration-300 ease-in-out shadow-md"
                >
                  Switch Camera
                </button>
                <button
                  onClick={resetScanner}
                  className="flex-1 bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-3 px-4 rounded-lg transition duration-300 ease-in-out shadow-md"
                >
                  Retry Scanning
                </button>
              </div>

              {scanResult && (
                <div className="bg-gray-100 p-4 rounded-lg mt-4 shadow-inner">
                  <p className="text-gray-800 font-semibold">Last Scanned QR Code:</p>
                  <p className="text-gray-600 break-words">{scanResult}</p>
                </div>
              )}

              {/* Manual Input Section */}
              <div className="mt-6 pt-6 border-t border-gray-200">
                <h3 className="text-lg font-semibold text-gray-800 mb-3">Manual QR Code Entry</h3>
                <div className="mb-4">
                  <input
                    type="text"
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
              </div>
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

      // ... (rest of the renderContent function remains the same)
      // For brevity, I've omitted the other cases (scan-history, report-counterfeit, etc.)
      // as they don't require changes for this QR scanning improvement.

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
      <div className={`text-center text-lg font-semibold p-3 rounded-lg w-full mb-8 ${
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