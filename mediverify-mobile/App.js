// App.js for MediVerify Mobile Application (React Native / Expo) - Enhanced UI

import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Image,
  Alert,
  PermissionsAndroid,
  Platform,
  SafeAreaView // For safe area handling on notched devices
} from 'react-native';
import QRCodeScanner from 'react-native-qrcode-scanner';
import { RNCamera } from 'react-native-camera';
import { launchImageLibrary } from 'react-native-image-picker';
import { Ionicons, MaterialCommunityIcons, FontAwesome } from '@expo/vector-icons'; // Import icons

// IMPORTANT: This MUST be your Replit backend's public URL.
// REPLACE THIS PLACEHOLDER WITH YOUR ACTUAL BACKEND PUBLIC URL (e.g., https://your-backend-slug.replit.dev/api)
const API_BASE_URL = 'https://07ecd53a-4463-400d-a252-37769a5e9e7f-00-1fva6us9oqckd.spock.replit.dev/api'; // <--- UPDATE THIS LINE

export default function App() {
  // --- Core Verification States ---
  const [scanResult, setScanResult] = useState('');
  const [message, setMessage] = useState('Point your camera at a drug\'s QR code or enter it manually.');
  const [verificationData, setVerificationData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [manualQrInput, setManualQrInput] = useState('');
  const [cameraPermissionGranted, setCameraPermissionGranted] = useState(false);

  // --- AI Verification States ---
  const [selectedImageUri, setSelectedImageUri] = useState(null);
  const [aiResult, setAiResult] = useState(null);
  const [isUploading, setIsUploading] = useState(false);

  // --- Navigation/Admin States ---
  const [currentPage, setCurrentPage] = useState('verify');
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [adminSessionKey, setAdminSessionKey] = useState(null);

  // --- Admin Data States (Fetched from Backend) ---
  const [manufacturers, setManufacturers] = useState([]);
  const [registeredDrugs, setRegisteredDrugs] = useState([]);
  const [newManufacturer, setNewManufacturer] = useState({ id: '', name: '', location: '', contact: '' });
  const [newDrug, setNewDrug] = useState({ qrCode: '', drugName: '', manufacturer: '', batchNumber: '', expiryDate: '', description: '' });
  const [expiringDrugs, setExpiringDrugs] = useState([]);
  const [expiryThresholdDays, setExpiryThresholdDays] = useState(90);

  // --- Notification States ---
  const [notifications, setNotifications] = useState([]);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  // --- Utility Function for Expiry Check ---
  const isExpiringSoon = (expiryDateString, days = 90) => {
    if (!expiryDateString) return false;
    const expiry = new Date(expiryDateString);
    const today = new Date();
    const futureDate = new Date();
    futureDate.setDate(today.getDate() + days);
    return expiry > today && expiry <= futureDate;
  };

  // --- Camera Permission Request ---
  useEffect(() => {
    const requestCameraPermission = async () => {
      if (Platform.OS === 'android') {
        try {
          const granted = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.CAMERA,
            {
              title: 'Camera Permission',
              message: 'MediVerify needs access to your camera to scan QR codes.',
              buttonNeutral: 'Ask Me Later',
              buttonNegative: 'Cancel',
              buttonPositive: 'OK',
            },
          );
          if (granted === PermissionsAndroid.RESULTS.GRANTED) {
            setCameraPermissionGranted(true);
            setMessage('Camera permission granted. Ready to scan.');
          } else {
            setMessage('Camera permission denied. Manual QR input is available.');
          }
        } catch (err) {
          console.warn(err);
          setMessage('Error requesting camera permission.');
        }
      } else {
        setCameraPermissionGranted(true); // Assume granted for iOS or handle specific iOS permission flow
      }
    };

    requestCameraPermission();
  }, []);


  // --- Data Fetching Functions (Admin Only) ---
  const fetchManufacturers = async () => {
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
        Alert.alert('Error', `Failed to load manufacturers: ${result.message}`);
      }
    } catch (error) {
      console.error('Error fetching manufacturers:', error);
      Alert.alert('Network Error', 'Could not connect to backend to fetch manufacturers.');
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
        headers: { 'X-Admin-Key': adminSessionKey }
      });
      const result = await response.json();
      if (response.ok && result.success) {
        setRegisteredDrugs(result.data);
        setMessage('Registered drugs loaded.');
      } else {
        Alert.alert('Error', `Failed to load drugs: ${result.message}`);
      }
    } catch (error) {
      console.error('Error fetching registered drugs:', error);
      Alert.alert('Network Error', 'Could not connect to backend to fetch drugs.');
    } finally {
      setIsLoading(false);
    }
  };

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
        Alert.alert('Error', `Failed to load expiring drugs: ${result.message || 'None found or error.'}`);
      }
    } catch (error) {
      console.error('Error fetching expiring drugs:', error);
      Alert.alert('Network Error', 'Could not connect to backend to fetch expiring drugs.');
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
        fetchScanHistory(); // Refresh scan history after a new scan
        fetchNotifications(); // Refresh notifications in case a recall notification was created
      } else {
        setMessage(`Verification failed: ${result.message || 'An unknown error occurred.'}`);
        setVerificationData(null);
      }
    } catch (error) {
      console.error('Error during QR verification:', error);
      Alert.alert('Network Error', 'Could not connect to backend for QR verification. Ensure backend is running and URL is correct.');
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

  const onReadQrCode = ({ data }) => {
    setScanResult(data);
    setManualQrInput(data);
    handleVerify(data);
  };

  // --- AI Verification Functions ---

  const pickImage = async () => {
    const options = {
      mediaType: 'photo',
      quality: 0.8,
      includeBase64: false,
    };

    launchImageLibrary(options, (response) => {
      if (response.didCancel) {
        setMessage('Image selection cancelled.');
      } else if (response.errorCode) {
        Alert.alert('Image Picker Error', response.errorMessage);
      } else if (response.assets && response.assets.length > 0) {
        setSelectedImageUri(response.assets[0].uri);
        setMessage('Image selected. Ready for AI analysis.');
      }
    });
  };

  const verifyPackageAI = async () => {
    if (!selectedImageUri) {
      setMessage('Please select an image file first for AI verification.');
      return;
    }

    setIsUploading(true);
    setMessage('Uploading image for AI analysis...');
    setAiResult(null);
    setVerificationData(null);

    const formData = new FormData();
    formData.append('packageImage', {
      uri: selectedImageUri,
      name: selectedImageUri.split('/').pop(),
      type: 'image/jpeg',
    });

    try {
      const response = await fetch(`${API_BASE_URL}/verify-package-ai`, {
        method: 'POST',
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        body: formData,
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setAiResult(result.data);
        setMessage(`AI Analysis: ${result.message}`);
      } else {
        Alert.alert('AI Analysis Failed', result.message || 'An unknown error occurred.');
        setAiResult(null);
      }
    } catch (error) {
      console.error('Error during AI verification:', error);
      Alert.alert('Network Error', 'Could not connect to backend for AI verification.');
      setAiResult(null);
    } finally {
      setIsUploading(false);
      setSelectedImageUri(null);
    }
  };

  // --- Admin Functions ---

  const handleAdminLogin = async () => {
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
        Alert.alert('Login Failed', result.message || 'Invalid credentials.');
      }
    } catch (error) {
      console.error('Error during admin login:', error);
      Alert.alert('Network Error', 'Could not connect to backend for admin login.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegisterManufacturer = async () => {
    if (!isAdminLoggedIn || !adminSessionKey) {
      Alert.alert('Error', 'Admin not logged in.');
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
        Alert.alert('Success', `Manufacturer "${newManufacturer.name}" registered!`);
        setNewManufacturer({ id: '', name: '', location: '', contact: '' });
        fetchManufacturers();
      } else {
        Alert.alert('Error', `Failed to register manufacturer: ${result.message}`);
      }
    } catch (error) {
      console.error('Error registering manufacturer:', error);
      Alert.alert('Network Error', 'Could not connect to backend for manufacturer registration.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegisterDrug = async () => {
    if (!isAdminLoggedIn || !adminSessionKey) {
      Alert.alert('Error', 'Admin not logged in.');
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
        Alert.alert('Success', `Drug "${newDrug.drugName}" registered!`);
        setNewDrug({ qrCode: '', drugName: '', manufacturer: '', batchNumber: '', expiryDate: '', description: '' });
        fetchRegisteredDrugs();
      } else {
        Alert.alert('Error', `Failed to register drug: ${result.message}`);
      }
    } catch (error) {
      console.error('Error registering drug:', error);
      Alert.alert('Network Error', 'Could not connect to backend for drug registration.');
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
        Alert.alert('Error', `Failed to load scan history: ${result.message}`);
      }
    } catch (error) {
      console.error('Error fetching scan history:', error);
      Alert.alert('Network Error', 'Could not connect to backend to fetch scan history.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReportCounterfeit = async () => {
    if (!reportCounterfeitData.qrCode && !reportCounterfeitData.description) {
      Alert.alert('Input Required', 'Please fill in at least QR Code or Description for the report.');
      return;
    }
    setIsLoading(true);
    setMessage('Submitting counterfeit report...');
    try {
      const response = await fetch(`${API_BASE_URL}/report-counterfeit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reportCounterfeitData),
      });
      const result = await response.json();
      if (response.ok && result.success) {
        Alert.alert('Success', `Counterfeit report submitted! ${result.message || ''}`);
        setReportCounterfeitData({ qrCode: '', description: '', contact: '' });
      } else {
        Alert.alert('Submission Failed', result.message || 'An unknown error occurred.');
      }
    } catch (error) {
      console.error('Error submitting counterfeit report:', error);
      Alert.alert('Network Error', 'Could not connect to backend for reporting.');
    } finally {
      setIsLoading(false);
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
        Alert.alert('Error', `Failed to load notifications: ${result.message || 'None found or error.'}`);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
      Alert.alert('Network Error', 'Could not connect to backend to fetch notifications.');
    } finally {
      setIsLoading(false);
    }
  };

  const markNotificationAsRead = (id) => {
    // In a real app, you'd send an API call to mark as read in DB
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
          <ScrollView contentContainerStyle={styles.contentScrollContainer}>
            <View style={styles.sectionCard}>
              <Text style={styles.cardTitle}>Scan Drug QR Code</Text>
              {cameraPermissionGranted ? (
                <View style={styles.qrCodeScannerContainer}>
                  <QRCodeScanner
                    onRead={onReadQrCode}
                    flashMode={RNCamera.Constants.FlashMode.off}
                    reactivate={true}
                    reactivateTimeout={5000}
                    showMarker={true}
                    cameraStyle={styles.cameraStyle}
                    containerStyle={styles.cameraContainerStyle}
                  />
                  <Text style={styles.cameraHint}>
                    Position the QR code within the frame.
                  </Text>
                </View>
              ) : (
                <View style={styles.cameraErrorContainer}>
                  <Text style={styles.cameraErrorTitle}>Camera Not Available!</Text>
                  <Text style={styles.cameraErrorMessage}>Please grant camera access to use the scanner.</Text>
                  <Text style={styles.cameraErrorMessage}>You can still use manual QR input below.</Text>
                </View>
              )}

              {scanResult ? (
                <View style={styles.scanResultContainer}>
                  <Text style={styles.scanResultText}>Last Scanned QR Code:</Text>
                  <Text style={styles.scanResultValue}>{scanResult}</Text>
                </View>
              ) : null}

              <Text style={styles.inputLabel}>Or Enter QR Code Manually:</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g., MEDIVERIFY-DRUG-XYZ-789"
                value={manualQrInput}
                onChangeText={setManualQrInput}
              />
              <TouchableOpacity
                style={[styles.button, (!manualQrInput || isLoading) && styles.buttonDisabled]}
                onPress={() => handleVerify(manualQrInput)}
                disabled={!manualQrInput || isLoading}
              >
                {isLoading && !aiResult ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>Verify QR Code</Text>
                )}
              </TouchableOpacity>
            </View>

            <View style={styles.sectionCard}>
              <Text style={styles.cardTitle}>AI Visual Package Verification</Text>
              <Text style={styles.cardDescription}>
                Upload an image of the drug package for AI-powered authenticity analysis (simulated).
              </Text>
              {selectedImageUri && (
                <Image source={{ uri: selectedImageUri }} style={styles.selectedImage} />
              )}
              <TouchableOpacity style={styles.button} onPress={pickImage}>
                <Text style={styles.buttonText}>Select Image</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, (!selectedImageUri || isUploading) && styles.buttonDisabled]}
                onPress={verifyPackageAI}
                disabled={!selectedImageUri || isUploading}
              >
                {isUploading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>Analyze Package with AI</Text>
                )}
              </TouchableOpacity>
              {aiResult && (
                <View style={styles.aiResultContainer}>
                  <Text style={styles.aiResultTitle}>AI Analysis Result:</Text>
                  {aiResult.imageUrl && (
                    <Image source={{ uri: aiResult.imageUrl }} style={styles.uploadedAiImage} />
                  )}
                  <Text style={styles.aiResultText}>Authenticity: <Text style={[styles.aiResultValue, aiResult.authenticity.toLowerCase().includes('authentic') ? styles.textGreen : styles.textRed]}>{aiResult.authenticity.toUpperCase()}</Text></Text>
                  <Text style={styles.aiResultText}>Confidence: {Math.round(aiResult.confidence * 100)}%</Text>
                  <Text style={styles.aiResultText}>Details: {aiResult.details}</Text>
                </View>
              )}
            </View>

            {verificationData && (
              <View style={styles.sectionCard}>
                <Text style={styles.cardTitle}>Drug Details & Supply Chain</Text>
                {verificationData.isRecalled && (
                  <View style={styles.alertDanger}>
                    <Text style={styles.alertTextBold}>URGENT RECALL!</Text>
                    <Text style={styles.alertText}>This drug batch has been recalled. Do NOT use.</Text>
                  </View>
                )}
                {verificationData.expirySoon && (
                  <View style={styles.alertWarning}>
                    <Text style={styles.alertTextBold}>EXPIRY ALERT!</Text>
                    <Text style={styles.alertText}>This drug is expiring soon (within {expiryThresholdDays} days).</Text>
                  </View>
                )}
                <Text style={styles.cardDescription}>
                  Information retrieved from the secure blockchain ledger.
                </Text>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>QR Code:</Text><Text style={styles.detailValue}>{verificationData.qrCode}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Drug Name:</Text><Text style={styles.detailValue}>{verificationData.drugName}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Manufacturer:</Text><Text style={styles.detailValue}>{verificationData.manufacturer}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Batch Number:</Text><Text style={styles.detailValue}>{verificationData.batchNumber}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Expiry Date:</Text><Text style={styles.detailValue}>{verificationData.expiryDate}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Status:</Text>
                  <Text style={[styles.detailValue, verificationData.status.toLowerCase().includes('authentic') ? styles.textGreen : styles.textRed]}>
                    {verificationData.status.toUpperCase()}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Description:</Text><Text style={styles.detailValue}>{verificationData.description}</Text>
                </View>

                <Text style={styles.subSectionTitle}>Supply Chain Traceability:</Text>
                <Text style={styles.cardDescription}>
                  Track the journey of this drug from manufacturing to distribution, ensuring transparency and security.
                </Text>
                {verificationData.supplyChain && verificationData.supplyChain.length > 0 ? (
                  verificationData.supplyChain.map((step, index) => (
                    <Text key={index} style={styles.listItem}>• {step}</Text>
                  ))
                ) : (
                  <Text style={styles.listItem}>No detailed supply chain steps recorded for this drug.</Text>
                )}
              </View>
            )}
          </ScrollView>
        );

      case 'scan-history':
        return (
          <ScrollView contentContainerStyle={styles.contentScrollContainer}>
            <View style={styles.sectionCard}>
              <Text style={styles.cardTitle}>Your Scan History</Text>
              {scanHistory.length > 0 ? (
                <View style={styles.tableContainer}>
                  {scanHistory.map((scan) => (
                    <View key={scan.id} style={styles.tableRow}>
                      <Text style={styles.tableCell}><Text style={styles.detailLabel}>Time:</Text> {scan.scanned_at ? new Date(scan.scanned_at).toLocaleString() : 'N/A'}</Text>
                      <Text style={styles.tableCell}><Text style={styles.detailLabel}>QR Code:</Text> {scan.qr_code}</Text>
                      <Text style={styles.tableCell}><Text style={styles.detailLabel}>Drug Name:</Text> {scan.drug_name || 'N/A'}</Text>
                      <Text style={styles.tableCell}><Text style={styles.detailLabel}>Status:</Text>{' '}
                        <Text style={[styles.detailValue, scan.status.toLowerCase().includes('authentic') ? styles.textGreen : styles.textRed]}>
                          {scan.status.toUpperCase()}
                        </Text>
                      </Text>
                      <Text style={styles.tableCell}><Text style={styles.detailLabel}>Recall:</Text>{' '}
                        {scan.is_recalled ? <Text style={styles.textRed}>YES</Text> : 'No'}
                      </Text>
                      <Text style={styles.tableCell}><Text style={styles.detailLabel}>Expiring Soon:</Text>{' '}
                        {scan.expiry_date && isExpiringSoon(scan.expiry_date) ? <Text style={styles.textOrange}>YES</Text> : 'No'}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={styles.noDataText}>No scan history yet. Verify a drug to see it here!</Text>
              )}
            </View>
          </ScrollView>
        );

      case 'report-counterfeit':
        return (
          <ScrollView contentContainerStyle={styles.contentScrollContainer}>
            <View style={styles.sectionCard}>
              <Text style={styles.cardTitle}>Report Suspected Counterfeit</Text>
              <Text style={styles.cardDescription}>Help us fight fake drugs by reporting suspicious products.</Text>
              <Text style={styles.inputLabel}>QR Code (if available):</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g., MEDIVERIFY-DRUG-XYZ-789"
                value={reportCounterfeitData.qrCode}
                onChangeText={(text) => setReportCounterfeitData({ ...reportCounterfeitData, qrCode: text })}
              />
              <Text style={styles.inputLabel}>Description of Suspicion:</Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                placeholder="e.g., Packaging looks off, unusual smell, no effect after taking."
                multiline
                numberOfLines={4}
                value={reportCounterfeitData.description}
                onChangeText={(text) => setReportCounterfeitData({ ...reportCounterfeitData, description: text })}
                required
              />
              <Text style={styles.inputLabel}>Your Contact Info (Optional):</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Email or Phone (e.g., your@example.com)"
                value={reportCounterfeitData.contact}
                onChangeText={(text) => setReportCounterfeitData({ ...reportCounterfeitData, contact: text })}
              />
              <TouchableOpacity
                style={[styles.button, isLoading && styles.buttonDisabled]}
                onPress={handleReportCounterfeit}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>Submit Report</Text>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        );

      case 'notifications':
        return (
          <ScrollView contentContainerStyle={styles.contentScrollContainer}>
            <View style={styles.sectionCard}>
              <Text style={styles.cardTitle}>Notifications</Text>
              {notifications.length > 0 ? (
                notifications.map((notification) => (
                  <View
                    key={notification.id}
                    style={[
                      styles.notificationItem,
                      notification.is_read ? styles.notificationRead : styles.notificationUnread,
                    ]}
                  >
                    <View style={styles.notificationIconContainer}>
                      {notification.type === 'recall_alert' && (
                        <Ionicons name="warning" size={24} color="#D32F2F" />
                      )}
                      {/* Add icons for other notification types here */}
                    </View>
                    <View style={styles.notificationContent}>
                      <Text style={styles.notificationMessage}>{notification.message}</Text>
                      {notification.related_qr_code && (
                        <Text style={styles.notificationDetail}>QR: {notification.related_qr_code}</Text>
                      )}
                      <Text style={styles.notificationDetail}>
                        {new Date(notification.created_at).toLocaleString()}
                      </Text>
                    </View>
                    {!notification.is_read && (
                      <TouchableOpacity
                        style={styles.markReadButton}
                        onPress={() => markNotificationAsRead(notification.id)}
                      >
                        <Text style={styles.markReadButtonText}>Mark as Read</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ))
              ) : (
                <Text style={styles.noDataText}>No new notifications.</Text>
              )}
            </View>
          </ScrollView>
        );

      case 'admin-login':
        return (
          <ScrollView contentContainerStyle={styles.contentScrollContainer}>
            <View style={styles.sectionCard}>
              <Text style={styles.cardTitle}>Admin Login</Text>
              <Text style={styles.inputLabel}>Username:</Text>
              <TextInput
                style={styles.textInput}
                value={adminUsername}
                onChangeText={setAdminUsername}
                required
              />
              <Text style={styles.inputLabel}>Password:</Text>
              <TextInput
                style={styles.textInput}
                secureTextEntry
                value={adminPassword}
                onChangeText={setAdminPassword}
                required
              />
              <TouchableOpacity
                style={[styles.button, isLoading && styles.buttonDisabled]}
                onPress={handleAdminLogin}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>Login</Text>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        );

      case 'admin-dashboard':
        return (
          <ScrollView contentContainerStyle={styles.contentScrollContainer}>
            <View style={styles.sectionCard}>
              <Text style={styles.cardTitle}>Admin Dashboard</Text>
              <Text style={styles.cardDescription}>Manage manufacturers and drug registrations.</Text>
              <TouchableOpacity style={styles.adminButton} onPress={() => setCurrentPage('register-manufacturer')}>
                <Text style={styles.adminButtonText}>Register Manufacturer</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.adminButton} onPress={() => setCurrentPage('register-drug')}>
                <Text style={styles.adminButtonText}>Register Drug</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.adminButton} onPress={() => setCurrentPage('view-manufacturers')}>
                <Text style={styles.adminButtonText}>View Manufacturers</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.adminButton} onPress={() => setCurrentPage('view-drugs')}>
                <Text style={styles.adminButtonText}>View Registered Drugs</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.adminButton} onPress={() => setCurrentPage('view-expiring-drugs')}>
                <Text style={styles.adminButtonText}>View Expiring Drugs</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.backButton} onPress={handleAdminLogout}>
                <Text style={styles.buttonText}>Logout</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        );

      case 'register-manufacturer':
        return (
          <ScrollView contentContainerStyle={styles.contentScrollContainer}>
            <View style={styles.sectionCard}>
              <Text style={styles.cardTitle}>Register New Manufacturer</Text>
              <Text style={styles.inputLabel}>Manufacturer ID:</Text>
              <TextInput style={styles.textInput} placeholder="e.g., MFR003" value={newManufacturer.id} onChangeText={(text) => setNewManufacturer({ ...newManufacturer, id: text })} required />
              <Text style={styles.inputLabel}>Manufacturer Name:</Text>
              <TextInput style={styles.textInput} value={newManufacturer.name} onChangeText={(text) => setNewManufacturer({ ...newManufacturer, name: text })} required />
              <Text style={styles.inputLabel}>Location:</Text>
              <TextInput style={styles.textInput} value={newManufacturer.location} onChangeText={(text) => setNewManufacturer({ ...newManufacturer, location: text })} required />
              <Text style={styles.inputLabel}>Contact Info:</Text>
              <TextInput style={styles.textInput} value={newManufacturer.contact} onChangeText={(text) => setNewManufacturer({ ...newManufacturer, contact: text })} />
              <TouchableOpacity style={[styles.button, isLoading && styles.buttonDisabled]} onPress={handleRegisterManufacturer} disabled={isLoading}>
                {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Register Manufacturer</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={styles.backButton} onPress={() => setCurrentPage('admin-dashboard')}>
                <Text style={styles.buttonText}>Back to Dashboard</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        );

      case 'register-drug':
        return (
          <ScrollView contentContainerStyle={styles.contentScrollContainer}>
            <View style={styles.sectionCard}>
              <Text style={styles.cardTitle}>Register New Drug</Text>
              <Text style={styles.inputLabel}>QR Code:</Text>
              <TextInput style={styles.textInput} placeholder="e.g., MEDIVERIFY-DRUG-NEW-123" value={newDrug.qrCode} onChangeText={(text) => setNewDrug({ ...newDrug, qrCode: text })} required />
              <Text style={styles.inputLabel}>Drug Name:</Text>
              <TextInput style={styles.textInput} value={newDrug.drugName} onChangeText={(text) => setNewDrug({ ...newDrug, drugName: text })} required />
              <Text style={styles.inputLabel}>Manufacturer ID:</Text>
              <TextInput style={styles.textInput} placeholder="e.g., MFR001 (must be an existing manufacturer ID)" value={newDrug.manufacturer} onChangeText={(text) => setNewDrug({ ...newDrug,manufactur
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
                                                                                                                                                                                                        <label htmlFor="expiryDays" className="block text-gray-700 text-lg font-semibold mb-2">Expiring within (days):</label>
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
                                                                                                                                                                                        <SafeAreaView style={styles.safeArea}>
                                                                                                                                                                                          <View style={styles.container}>
                                                                                                                                                                                            <View style={styles.header}>
                                                                                                                                                                                              <Text style={styles.headerTitle}>MediVerify</Text>
                                                                                                                                                                                              <Text style={styles.headerSubtitle}>Authenticating Medicines, Ensuring Patient Safety.</Text>
                                                                                                                                                                                            </View>

                                                                                                                                                                                            <View style={[styles.messageContainer,
                                                                                                                                                                                              isLoading || isUploading ? styles.messageYellow :
                                                                                                                                                                                              (message.includes('Error') || message.includes('failed') || message.includes('denied') || message.includes('Invalid')) ? styles.messageRed :
                                                                                                                                                                                              (verificationData || aiResult || message.includes('successful') || message.includes('registered')) ? styles.messageGreen :
                                                                                                                                                                                              styles.messageGray
                                                                                                                                                                                            ]}>
                                                                                                                                                                                              <Text style={styles.messageText}>{message}</Text>
                                                                                                                                                                                            </View>

                                                                                                                                                                                            {renderContent()}

                                                                                                                                                                                            {(isLoading || isUploading) && (
                                                                                                                                                                                              <View style={styles.loadingOverlay}>
                                                                                                                                                                                                <View style={styles.loadingBox}>
                                                                                                                                                                                                  <ActivityIndicator size="large" color="#4CAF50" />
                                                                                                                                                                                                  <Text style={styles.loadingText}>Processing request...</Text>
                                                                                                                                                                                                </View>
                                                                                                                                                                                              </View>
                                                                                                                                                                                            )}
                                                                                                                                                                                          </View>

                                                                                                                                                                                          {/* Bottom Tab Navigation */}
                                                                                                                                                                                          <View style={styles.bottomNav}>
                                                                                                                                                                                            <TouchableOpacity
                                                                                                                                                                                              style={[styles.bottomNavButton, currentPage === 'verify' && styles.bottomNavButtonActive]}
                                                                                                                                                                                              onPress={() => setCurrentPage('verify')}
                                                                                                                                                                                            >
                                                                                                                                                                                              <Ionicons name="scan-circle-outline" size={24} color={currentPage === 'verify' ? '#2E7D32' : '#757575'} />
                                                                                                                                                                                              <Text style={[styles.bottomNavText, currentPage === 'verify' && styles.bottomNavTextActive]}>Verify</Text>
                                                                                                                                                                                            </TouchableOpacity>
                                                                                                                                                                                            <TouchableOpacity
                                                                                                                                                                                              style={[styles.bottomNavButton, currentPage === 'scan-history' && styles.bottomNavButtonActive]}
                                                                                                                                                                                              onPress={() => setCurrentPage('scan-history')}
                                                                                                                                                                                            >
                                                                                                                                                                                              <MaterialCommunityIcons name="history" size={24} color={currentPage === 'scan-history' ? '#FBC02D' : '#757575'} />
                                                                                                                                                                                              <Text style={[styles.bottomNavText, currentPage === 'scan-history' && styles.bottomNavTextActive]}>History</Text>
                                                                                                                                                                                            </TouchableOpacity>
                                                                                                                                                                                            <TouchableOpacity
                                                                                                                                                                                              style={[styles.bottomNavButton, currentPage === 'report-counterfeit' && styles.bottomNavButtonActive]}
                                                                                                                                                                                              onPress={() => setCurrentPage('report-counterfeit')}
                                                                                                                                                                                            >
                                                                                                                                                                                              <Ionicons name="alert-circle-outline" size={24} color={currentPage === 'report-counterfeit' ? '#D32F2F' : '#757575'} />
                                                                                                                                                                                              <Text style={[styles.bottomNavText, currentPage === 'report-counterfeit' && styles.bottomNavTextActive]}>Report</Text>
                                                                                                                                                                                            </TouchableOpacity>
                                                                                                                                                                                            <TouchableOpacity
                                                                                                                                                                                              style={[styles.bottomNavButton, currentPage === 'notifications' && styles.bottomNavButtonActive]}
                                                                                                                                                                                              onPress={() => setCurrentPage('notifications')}
                                                                                                                                                                                            >
                                                                                                                                                                                              <Ionicons name="notifications-outline" size={24} color={currentPage === 'notifications' ? '#1976D2' : '#757575'} />
                                                                                                                                                                                              {unreadNotificationCount > 0 && (
                                                                                                                                                                                                <View style={styles.badge}>
                                                                                                                                                                                                  <Text style={styles.badgeText}>{unreadNotificationCount}</Text>
                                                                                                                                                                                                </View>
                                                                                                                                                                                              )}
                                                                                                                                                                                              <Text style={[styles.bottomNavText, currentPage === 'notifications' && styles.bottomNavTextActive]}>Alerts</Text>
                                                                                                                                                                                            </TouchableOpacity>
                                                                                                                                                                                            {!isAdminLoggedIn ? (
                                                                                                                                                                                              <TouchableOpacity
                                                                                                                                                                                                style={[styles.bottomNavButton, currentPage === 'admin-login' && styles.bottomNavButtonActive]}
                                                                                                                                                                                                onPress={() => setCurrentPage('admin-login')}
                                                                                                                                                                                              >
                                                                                                                                                                                                <FontAwesome name="user-circle-o" size={24} color={currentPage === 'admin-login' ? '#EF6C00' : '#757575'} />
                                                                                                                                                                                                <Text style={[styles.bottomNavText, currentPage === 'admin-login' && styles.bottomNavTextActive]}>Admin</Text>
                                                                                                                                                                                              </TouchableOpacity>
                                                                                                                                                                                            ) : (
                                                                                                                                                                                              <TouchableOpacity
                                                                                                                                                                                                style={[styles.bottomNavButton, currentPage.startsWith('admin') && styles.bottomNavButtonActive]}
                                                                                                                                                                                                onPress={() => setCurrentPage('admin-dashboard')}
                                                                                                                                                                                              >
                                                                                                                                                                                                <MaterialCommunityIcons name="view-dashboard-outline" size={24} color={currentPage.startsWith('admin') ? '#00897B' : '#757575'} />
                                                                                                                                                                                                <Text style={[styles.bottomNavText, currentPage.startsWith('admin') && styles.bottomNavTextActive]}>Dashboard</Text>
                                                                                                                                                                                              </TouchableOpacity>
                                                                                                                                                                                            )}
                                                                                                                                                                                          </View>
                                                                                                                                                                                        </SafeAreaView>
                                                                                                                                                                                      );
                                                                                                                                                                                    }

                                                                                                                                                                                    const styles = StyleSheet.create({
                                                                                                                                                                                      safeArea: {
                                                                                                                                                                                        flex: 1,
                                                                                                                                                                                        backgroundColor: '#E8F5E9', // Light green background
                                                                                                                                                                                      },
                                                                                                                                                                                      container: {
                                                                                                                                                                                        flex: 1,
                                                                                                                                                                                        alignItems: 'center',
                                                                                                                                                                                        padding: 16,
                                                                                                                                                                                        paddingBottom: 0, // Remove bottom padding as nav bar is there
                                                                                                                                                                                      },
                                                                                                                                                                                      header: {
                                                                                                                                                                                        width: '100%',
                                                                                                                                                                                        alignItems: 'center',
                                                                                                                                                                                        marginBottom: 20,
                                                                                                                                                                                        paddingTop: 10,
                                                                                                                                                                                      },
                                                                                                                                                                                      headerTitle: {
                                                                                                                                                                                        fontSize: 32,
                                                                                                                                                                                        fontWeight: 'bold',
                                                                                                                                                                                        color: '#2E7D32', // Darker green
                                                                                                                                                                                        backgroundColor: '#FFFFFF',
                                                                                                                                                                                        paddingVertical: 8,
                                                                                                                                                                                        paddingHorizontal: 15,
                                                                                                                                                                                        borderRadius: 10,
                                                                                                                                                                                        shadowColor: '#000',
                                                                                                                                                                                        shadowOffset: { width: 0, height: 2 },
                                                                                                                                                                                        shadowOpacity: 0.2,
                                                                                                                                                                                        shadowRadius: 4,
                                                                                                                                                                                        elevation: 5,
                                                                                                                                                                                      },
                                                                                                                                                                                      headerSubtitle: {
                                                                                                                                                                                        fontSize: 16,
                                                                                                                                                                                        color: '#4CAF50', // Green
                                                                                                                                                                                        marginTop: 5,
                                                                                                                                                                                      },
                                                                                                                                                                                      messageContainer: {
                                                                                                                                                                                        width: '100%',
                                                                                                                                                                                        padding: 12,
                                                                                                                                                                                        borderRadius: 8,
                                                                                                                                                                                        marginBottom: 20,
                                                                                                                                                                                        alignItems: 'center',
                                                                                                                                                                                      },
                                                                                                                                                                                      messageText: {
                                                                                                                                                                                        fontSize: 16,
                                                                                                                                                                                        fontWeight: 'bold',
                                                                                                                                                                                        textAlign: 'center',
                                                                                                                                                                                      },
                                                                                                                                                                                      messageYellow: {
                                                                                                                                                                                        backgroundColor: '#FFFDE7',
                                                                                                                                                                                        borderColor: '#FFEB3B',
                                                                                                                                                                                        borderWidth: 1,
                                                                                                                                                                                        color: '#FBC02D',
                                                                                                                                                                                      },
                                                                                                                                                                                      messageRed: {
                                                                                                                                                                                        backgroundColor: '#FFEBEE',
                                                                                                                                                                                        borderColor: '#F44336',
                                                                                                                                                                                        borderWidth: 1,
                                                                                                                                                                                        color: '#D32F2F',
                                                                                                                                                                                      },
                                                                                                                                                                                      messageGreen: {
                                                                                                                                                                                        backgroundColor: '#E8F5E9',
                                                                                                                                                                                        borderColor: '#4CAF50',
                                                                                                                                                                                        borderWidth: 1,
                                                                                                                                                                                        color: '#2E7D32',
                                                                                                                                                                                      },
                                                                                                                                                                                      messageGray: {
                                                                                                                                                                                        backgroundColor: '#F5F5F5',
                                                                                                                                                                                        borderColor: '#E0E0E0',
                                                                                                                                                                                        borderWidth: 1,
                                                                                                                                                                                        color: '#757575',
                                                                                                                                                                                      },
                                                                                                                                                                                      contentScrollContainer: {
                                                                                                                                                                                        width: '100%',
                                                                                                                                                                                        paddingBottom: 20, // Add padding for scrollable content above nav bar
                                                                                                                                                                                      },
                                                                                                                                                                                      sectionCard: {
                                                                                                                                                                                        backgroundColor: '#FFFFFF',
                                                                                                                                                                                        borderRadius: 15,
                                                                                                                                                                                        padding: 20,
                                                                                                                                                                                        shadowColor: '#000',
                                                                                                                                                                                        shadowOffset: { width: 0, height: 4 },
                                                                                                                                                                                        shadowOpacity: 0.1,
                                                                                                                                                                                        shadowRadius: 8,
                                                                                                                                                                                        elevation: 8,
                                                                                                                                                                                        marginBottom: 20,
                                                                                                                                                                                        width: '100%',
                                                                                                                                                                                      },
                                                                                                                                                                                      cardTitle: {
                                                                                                                                                                                        fontSize: 22,
                                                                                                                                                                                        fontWeight: 'bold',
                                                                                                                                                                                        color: '#333',
                                                                                                                                                                                        marginBottom: 10,
                                                                                                                                                                                        textAlign: 'center',
                                                                                                                                                                                      },
                                                                                                                                                                                      cardDescription: {
                                                                                                                                                                                        fontSize: 14,
                                                                                                                                                                                        color: '#666',
                                                                                                                                                                                        marginBottom: 15,
                                                                                                                                                                                        textAlign: 'center',
                                                                                                                                                                                      },
                                                                                                                                                                                      qrCodeScannerContainer: {
                                                                                                                                                                                        height: 250, // Fixed height for scanner
                                                                                                                                                                                        width: '100%',
                                                                                                                                                                                        overflow: 'hidden',
                                                                                                                                                                                        borderRadius: 10,
                                                                                                                                                                                        marginBottom: 15,
                                                                                                                                                                                        borderWidth: 2,
                                                                                                                                                                                        borderColor: '#4CAF50', // Green border for scanner
                                                                                                                                                                                        justifyContent: 'center',
                                                                                                                                                                                        alignItems: 'center',
                                                                                                                                                                                      },
                                                                                                                                                                                      cameraStyle: {
                                                                                                                                                                                        height: '100%',
                                                                                                                                                                                        width: '100%',
                                                                                                                                                                                        overflow: 'hidden',
                                                                                                                                                                                      },
                                                                                                                                                                                      cameraContainerStyle: {
                                                                                                                                                                                        height: '100%',
                                                                                                                                                                                        width: '100%',
                                                                                                                                                                                        overflow: 'hidden',
                                                                                                                                                                                        justifyContent: 'center',
                                                                                                                                                                                        alignItems: 'center',
                                                                                                                                                                                      },
                                                                                                                                                                                      cameraHint: {
                                                                                                                                                                                        position: 'absolute',
                                                                                                                                                                                        bottom: 10,
                                                                                                                                                                                        color: 'white',
                                                                                                                                                                                        backgroundColor: 'rgba(0,0,0,0.6)',
                                                                                                                                                                                        paddingVertical: 5,
                                                                                                                                                                                        paddingHorizontal: 10,
                                                                                                                                                                                        borderRadius: 5,
                                                                                                                                                                                        fontSize: 12,
                                                                                                                                                                                      },
                                                                                                                                                                                      cameraErrorContainer: {
                                                                                                                                                                                        height: 250,
                                                                                                                                                                                        width: '100%',
                                                                                                                                                                                        backgroundColor: '#FFEBEE',
                                                                                                                                                                                        borderRadius: 10,
                                                                                                                                                                                        justifyContent: 'center',
                                                                                                                                                                                        alignItems: 'center',
                                                                                                                                                                                        padding: 15,
                                                                                                                                                                                        marginBottom: 15,
                                                                                                                                                                                        borderWidth: 1,
                                                                                                                                                                                        borderColor: '#F44336',
                                                                                                                                                                                      },
                                                                                                                                                                                      cameraErrorTitle: {
                                                                                                                                                                                        fontSize: 18,
                                                                                                                                                                                        fontWeight: 'bold',
                                                                                                                                                                                        color: '#D32F2F',
                                                                                                                                                                                        marginBottom: 8,
                                                                                                                                                                                      },
                                                                                                                                                                                      cameraErrorMessage: {
                                                                                                                                                                                        fontSize: 14,
                                                                                                                                                                                        color: '#D32F2F',
                                                                                                                                                                                        textAlign: 'center',
                                                                                                                                                                                      },
                                                                                                                                                                                      scanResultContainer: {
                                                                                                                                                                                        backgroundColor: '#F5F5F5',
                                                                                                                                                                                        padding: 15,
                                                                                                                                                                                        borderRadius: 10,
                                                                                                                                                                                        marginBottom: 15,
                                                                                                                                                                                        borderWidth: 1,
                                                                                                                                                                                        borderColor: '#E0E0E0',
                                                                                                                                                                                      },
                                                                                                                                                                                      scanResultText: {
                                                                                                                                                                                        fontSize: 16,
                                                                                                                                                                                        fontWeight: 'bold',
                                                                                                                                                                                        color: '#555',
                                                                                                                                                                                        marginBottom: 5,
                                                                                                                                                                                      },
                                                                                                                                                                                      scanResultValue: {
                                                                                                                                                                                        fontSize: 14,
                                                                                                                                                                                        color: '#333',
                                                                                                                                                                                      },
                                                                                                                                                                                      inputLabel: {
                                                                                                                                                                                        fontSize: 16,
                                                                                                                                                                                        fontWeight: 'bold',
                                                                                                                                                                                        color: '#333',
                                                                                                                                                                                        marginBottom: 8,
                                                                                                                                                                                        marginTop: 10,
                                                                                                                                                                                      },
                                                                                                                                                                                      textInput: {
                                                                                                                                                                                        width: '100%',
                                                                                                                                                                                        padding: 12,
                                                                                                                                                                                        borderWidth: 1,
                                                                                                                                                                                        borderColor: '#DDD',
                                                                                                                                                                                        borderRadius: 8,
                                                                                                                                                                                        marginBottom: 15,
                                                                                                                                                                                        fontSize: 16,
                                                                                                                                                                                        color: '#333',
                                                                                                                                                                                        backgroundColor: '#FFF',
                                                                                                                                                                                      },
                                                                                                                                                                                      textArea: {
                                                                                                                                                                                        height: 100,
                                                                                                                                                                                        textAlignVertical: 'top',
                                                                                                                                                                                      },
                                                                                                                                                                                      button: {
                                                                                                                                                                                        backgroundColor: '#4CAF50', // Green
                                                                                                                                                                                        paddingVertical: 14,
                                                                                                                                                                                        paddingHorizontal: 20,
                                                                                                                                                                                        borderRadius: 10,
                                                                                                                                                                                        alignItems: 'center',
                                                                                                                                                                                        marginBottom: 10,
                                                                                                                                                                                        shadowColor: '#000',
                                                                                                                                                                                        shadowOffset: { width: 0, height: 2 },
                                                                                                                                                                                        shadowOpacity: 0.2,
                                                                                                                                                                                        shadowRadius: 4,
                                                                                                                                                                                        elevation: 5,
                                                                                                                                                                                      },
                                                                                                                                                                                      buttonDisabled: {
                                                                                                                                                                                        backgroundColor: '#A5D6A7', // Lighter green for disabled
                                                                                                                                                                                      },
                                                                                                                                                                                      buttonText: {
                                                                                                                                                                                        color: '#FFFFFF',
                                                                                                                                                                                        fontSize: 18,
                                                                                                                                                                                        fontWeight: 'bold',
                                                                                                                                                                                      },
                                                                                                                                                                                      selectedImage: {
                                                                                                                                                                                        width: '100%',
                                                                                                                                                                                        height: 200,
                                                                                                                                                                                        resizeMode: 'contain',
                                                                                                                                                                                        borderRadius: 10,
                                                                                                                                                                                        marginBottom: 15,
                                                                                                                                                                                        borderWidth: 1,
                                                                                                                                                                                        borderColor: '#DDD',
                                                                                                                                                                                      },
                                                                                                                                                                                      aiResultContainer: {
                                                                                                                                                                                        backgroundColor: '#F3E5F5', // Light purple
                                                                                                                                                                                        padding: 15,
                                                                                                                                                                                        borderRadius: 10,
                                                                                                                                                                                        marginTop: 15,
                                                                                                                                                                                        borderWidth: 1,
                                                                                                                                                                                        borderColor: '#E1BEE7',
                                                                                                                                                                                      },
                                                                                                                                                                                      aiResultTitle: {
                                                                                                                                                                                        fontSize: 18,
                                                                                                                                                                                        fontWeight: 'bold',
                                                                                                                                                                                        color: '#6A1B9A', // Dark purple
                                                                                                                                                                                        marginBottom: 10,
                                                                                                                                                                                      },
                                                                                                                                                                                      aiResultText: {
                                                                                                                                                                                        fontSize: 15,
                                                                                                                                                                                        color: '#4A148C', // Even darker purple
                                                                                                                                                                                        marginBottom: 5,
                                                                                                                                                                                      },
                                                                                                                                                                                      aiResultValue: {
                                                                                                                                                                                        fontWeight: 'bold',
                                                                                                                                                                                      },
                                                                                                                                                                                      uploadedAiImage: {
                                                                                                                                                                                        width: '100%',
                                                                                                                                                                                        height: 180,
                                                                                                                                                                                        resizeMode: 'contain',
                                                                                                                                                                                        borderRadius: 8,
                                                                                                                                                                                        marginBottom: 10,
                                                                                                                                                                                        borderWidth: 1,
                                                                                                                                                                                        borderColor: '#D1C4E9',
                                                                                                                                                                                      },
                                                                                                                                                                                      detailRow: {
                                                                                                                                                                                        flexDirection: 'row',
                                                                                                                                                                                        justifyContent: 'space-between',
                                                                                                                                                                                        marginBottom: 5,
                                                                                                                                                                                        paddingVertical: 4,
                                                                                                                                                                                        borderBottomWidth: StyleSheet.hairlineWidth,
                                                                                                                                                                                        borderBottomColor: '#EEE',
                                                                                                                                                                                      },
                                                                                                                                                                                      detailText: {
                                                                                                                                                                                        fontSize: 15,
                                                                                                                                                                                        color: '#333',
                                                                                                                                                                                      },
                                                                                                                                                                                      detailLabel: {
                                                                                                                                                                                        fontWeight: 'bold',
                                                                                                                                                                                        color: '#555',
                                                                                                                                                                                        flex: 1,
                                                                                                                                                                                      },
                                                                                                                                                                                      detailValue: {
                                                                                                                                                                                        fontWeight: 'bold',
                                                                                                                                                                                        flex: 2,
                                                                                                                                                                                        textAlign: 'right',
                                                                                                                                                                                      },
                                                                                                                                                                                      textGreen: {
                                                                                                                                                                                        color: '#2E7D32',
                                                                                                                                                                                      },
                                                                                                                                                                                      textRed: {
                                                                                                                                                                                        color: '#D32F2F',
                                                                                                                                                                                      },
                                                                                                                                                                                      textOrange: {
                                                                                                                                                                                        color: '#EF6C00',
                                                                                                                                                                                      },
                                                                                                                                                                                      alertDanger: {
                                                                                                                                                                                        backgroundColor: '#FFEBEE',
                                                                                                                                                                                        borderColor: '#F44336',
                                                                                                                                                                                        borderWidth: 1,
                                                                                                                                                                                        padding: 10,
                                                                                                                                                                                        borderRadius: 8,
                                                                                                                                                                                        marginBottom: 15,
                                                                                                                                                                                      },
                                                                                                                                                                                      alertWarning: {
                                                                                                                                                                                        backgroundColor: '#FFF3E0',
                                                                                                                                                                                        borderColor: '#FF9800',
                                                                                                                                                                                        borderWidth: 1,
                                                                                                                                                                                        padding: 10,
                                                                                                                                                                                        borderRadius: 8,
                                                                                                                                                                                        marginBottom: 15,
                                                                                                                                                                                      },
                                                                                                                                                                                      alertTextBold: {
                                                                                                                                                                                        fontWeight: 'bold',
                                                                                                                                                                                        fontSize: 16,
                                                                                                                                                                                        color: '#D32F2F',
                                                                                                                                                                                      },
                                                                                                                                                                                      alertText: {
                                                                                                                                                                                        fontSize: 14,
                                                                                                                                                                                        color: '#D32F2F',
                                                                                                                                                                                      },
                                                                                                                                                                                      subSectionTitle: {
                                                                                                                                                                                        fontSize: 18,
                                                                                                                                                                                        fontWeight: 'bold',
                                                                                                                                                                                        color: '#333',
                                                                                                                                                                                        marginTop: 20,
                                                                                                                                                                                        marginBottom: 10,
                                                                                                                                                                                        textAlign: 'center',
                                                                                                                                                                                      },
                                                                                                                                                                                      listItem: {
                                                                                                                                                                                        fontSize: 15,
                                                                                                                                                                                        color: '#666',
                                                                                                                                                                                        marginBottom: 3,
                                                                                                                                                                                        marginLeft: 10,
                                                                                                                                                                                      },
                                                                                                                                                                                      tableContainer: {
                                                                                                                                                                                        borderWidth: 1,
                                                                                                                                                                                        borderColor: '#E0E0E0',
                                                                                                                                                                                        borderRadius: 8,
                                                                                                                                                                                        marginBottom: 15,
                                                                                                                                                                                        overflow: 'hidden',
                                                                                                                                                                                      },
                                                                                                                                                                                      tableRow: {
                                                                                                                                                                                        backgroundColor: '#FDFDFD',
                                                                                                                                                                                        padding: 10,
                                                                                                                                                                                        borderBottomWidth: 1,
                                                                                                                                                                                        borderBottomColor: '#EEE',
                                                                                                                                                                                      },
                                                                                                                                                                                      tableCell: {
                                                                                                                                                                                        fontSize: 14,
                                                                                                                                                                                        color: '#333',
                                                                                                                                                                                        marginBottom: 5,
                                                                                                                                                                                      },
                                                                                                                                                                                      noDataText: {
                                                                                                                                                                                        fontSize: 16,
                                                                                                                                                                                        color: '#666',
                                                                                                                                                                                        textAlign: 'center',
                                                                                                                                                                                        paddingVertical: 20,
                                                                                                                                                                                      },
                                                                                                                                                                                      backButton: {
                                                                                                                                                                                        backgroundColor: '#757575',
                                                                                                                                                                                        paddingVertical: 14,
                                                                                                                                                                                        paddingHorizontal: 20,
                                                                                                                                                                                        borderRadius: 10,
                                                                                                                                                                                        alignItems: 'center',
                                                                                                                                                                                        marginTop: 20,
                                                                                                                                                                                        shadowColor: '#000',
                                                                                                                                                                                        shadowOffset: { width: 0, height: 2 },
                                                                                                                                                                                        shadowOpacity: 0.2,
                                                                                                                                                                                        shadowRadius: 4,
                                                                                                                                                                                        elevation: 5,
                                                                                                                                                                                      },
                                                                                                                                                                                      adminButton: {
                                                                                                                                                                                        backgroundColor: '#2196F3', // Blue
                                                                                                                                                                                        paddingVertical: 14,
                                                                                                                                                                                        paddingHorizontal: 20,
                                                                                                                                                                                        borderRadius: 10,
                                                                                                                                                                                        alignItems: 'center',
                                                                                                                                                                                        marginBottom: 10,
                                                                                                                                                                                        shadowColor: '#000',
                                                                                                                                                                                        shadowOffset: { width: 0, height: 2 },
                                                                                                                                                                                        shadowOpacity: 0.2,
                                                                                                                                                                                        shadowRadius: 4,
                                                                                                                                                                                        elevation: 5,
                                                                                                                                                                                      },
                                                                                                                                                                                      adminButtonText: {
                                                                                                                                                                                        color: '#FFFFFF',
                                                                                                                                                                                        fontSize: 18,
                                                                                                                                                                                        fontWeight: 'bold',
                                                                                                                                                                                      },
                                                                                                                                                                                      notificationItem: {
                                                                                                                                                                                        flexDirection: 'row',
                                                                                                                                                                                        alignItems: 'center',
                                                                                                                                                                                        padding: 15,
                                                                                                                                                                                        borderRadius: 10,
                                                                                                                                                                                        marginBottom: 10,
                                                                                                                                                                                        shadowColor: '#000',
                                                                                                                                                                                        shadowOffset: { width: 0, height: 1 },
                                                                                                                                                                                        shadowOpacity: 0.1,
                                                                                                                                                                                        shadowRadius: 2,
                                                                                                                                                                                        elevation: 3,
                                                                                                                                                                                      },
                                                                                                                                                                                      notificationUnread: {
                                                                                                                                                                                        backgroundColor: '#E3F2FD', // Light blue for unread
                                                                                                                                                                                        borderColor: '#90CAF9',
                                                                                                                                                                                        borderWidth: 1,
                                                                                                                                                                                      },
                                                                                                                                                                                      notificationRead: {
                                                                                                                                                                                        backgroundColor: '#F5F5F5', // Light gray for read
                                                                                                                                                                                        borderColor: '#E0E0E0',
                                                                                                                                                                                        borderWidth: 1,
                                                                                                                                                                                      },
                                                                                                                                                                                      notificationIconContainer: {
                                                                                                                                                                                        marginRight: 10,
                                                                                                                                                                                      },
                                                                                                                                                                                      notificationContent: {
                                                                                                                                                                                        flex: 1,
                                                                                                                                                                                      },
                                                                                                                                                                                      notificationMessage: {
                                                                                                                                                                                        fontSize: 15,
                                                                                                                                                                                        fontWeight: 'bold',
                                                                                                                                                                                        color: '#333',
                                                                                                                                                                                      },
                                                                                                                                                                                      notificationDetail: {
                                                                                                                                                                                        fontSize: 12,
                                                                                                                                                                                        color: '#777',
                                                                                                                                                                                        marginTop: 3,
                                                                                                                                                                                      },
                                                                                                                                                                                      markReadButton: {
                                                                                                                                                                                        backgroundColor: '#BBDEFB', // Lighter blue
                                                                                                                                                                                        paddingVertical: 8,
                                                                                                                                                                                        paddingHorizontal: 12,
                                                                                                                                                                                        borderRadius: 20,
                                                                                                                                                                                        marginLeft: 10,
                                                                                                                                                                                      },
                                                                                                                                                                                      markReadButtonText: {
                                                                                                                                                                                        fontSize: 12,
                                                                                                                                                                                        fontWeight: 'bold',
                                                                                                                                                                                        color: '#1976D2', // Darker blue
                                                                                                                                                                                      },
                                                                                                                                                                                      filterContainer: {
                                                                                                                                                                                        flexDirection: 'row',
                                                                                                                                                                                        alignItems: 'center',
                                                                                                                                                                                        justifyContent: 'center',
                                                                                                                                                                                        marginBottom: 20,
                                                                                                                                                                                        padding: 10,
                                                                                                                                                                                        backgroundColor: '#F0F4C3', // Light yellow-green
                                                                                                                                                                                        borderRadius: 10,
                                                                                                                                                                                      },
                                                                                                                                                                                      filterTextInput: {
                                                                                                                                                                                        width: 80,
                                                                                                                                                                                        textAlign: 'center',
                                                                                                                                                                                        marginBottom: 0, // Override default textInput margin
                                                                                                                                                                                        marginHorizontal: 10,
                                                                                                                                                                                      },
                                                                                                                                                                                      filterButton: {
                                                                                                                                                                                        backgroundColor: '#8BC34A', // Light green
                                                                                                                                                                                        paddingVertical: 10,
                                                                                                                                                                                        paddingHorizontal: 15,
                                                                                                                                                                                        borderRadius: 8,
                                                                                                                                                                                        shadowColor: '#000',
                                                                                                                                                                                        shadowOffset: { width: 0, height: 1 },
                                                                                                                                                                                        shadowOpacity: 0.1,
                                                                                                                                                                                        shadowRadius: 2,
                                                                                                                                                                                        elevation: 3,
                                                                                                                                                                                      },
                                                                                                                                                                                      loadingOverlay: {
                                                                                                                                                                                        position: 'absolute',
                                                                                                                                                                                        top: 0,
                                                                                                                                                                                        left: 0,
                                                                                                                                                                                        right: 0,
                                                                                                                                                                                        bottom: 0,
                                                                                                                                                                                        backgroundColor: 'rgba(0,0,0,0.6)',
                                                                                                                                                                                        justifyContent: 'center',
                                                                                                                                                                                        alignItems: 'center',
                                                                                                                                                                                        zIndex: 1000,
                                                                                                                                                                                      },
                                                                                                                                                                                      loadingBox: {
                                                                                                                                                                                        backgroundColor: 'white',
                                                                                                                                                                                        padding: 25,
                                                                                                                                                                                        borderRadius: 15,
                                                                                                                                                                                        alignItems: 'center',
                                                                                                                                                                                        shadowColor: '#000',
                                                                                                                                                                                        shadowOffset: { width: 0, height: 4 },
                                                                                                                                                                                        shadowOpacity: 0.3,
                                                                                                                                                                                        shadowRadius: 10,
                                                                                                                                                                                        elevation: 15,
                                                                                                                                                                                      },
                                                                                                                                                                                      loadingText: {
                                                                                                                                                                                        marginTop: 15,
                                                                                                                                                                                        fontSize: 18,
                                                                                                                                                                                        fontWeight: 'bold',
                                                                                                                                                                                        color: '#333',
                                                                                                                                                                                      },
                                                                                                                                                                                      // Bottom Navigation Styles
                                                                                                                                                                                      bottomNav: {
                                                                                                                                                                                        flexDirection: 'row',
                                                                                                                                                                                        justifyContent: 'space-around',
                                                                                                                                                                                        alignItems: 'center',
                                                                                                                                                                                        backgroundColor: '#FFFFFF',
                                                                                                                                                                                        paddingVertical: 10,
                                                                                                                                                                                        borderTopWidth: 1,
                                                                                                                                                                                        borderTopColor: '#E0E0E0',
                                                                                                                                                                                        shadowColor: '#000',
                                                                                                                                                                                        shadowOffset: { width: 0, height: -2 },
                                                                                                                                                                                        shadowOpacity: 0.1,
                                                                                                                                                                                        shadowRadius: 4,
                                                                                                                                                                                        elevation: 10,
                                                                                                                                                                                        width: '100%',
                                                                                                                                                                                        paddingBottom: Platform.OS === 'ios' ? 20 : 0, // Adjust for iPhone X safe area
                                                                                                                                                                                      },
                                                                                                                                                                                      bottomNavButton: {
                                                                                                                                                                                        flex: 1,
                                                                                                                                                                                        alignItems: 'center',
                                                                                                                                                                                        paddingVertical: 5,
                                                                                                                                                                                      },
                                                                                                                                                                                      bottomNavButtonActive: {
                                                                                                                                                                                        // No specific background change, rely on text/icon color change
                                                                                                                                                                                      },
                                                                                                                                                                                      bottomNavText: {
                                                                                                                                                                                        fontSize: 12,
                                                                                                                                                                                        color: '#757575', // Gray for inactive
                                                                                                                                                                                        marginTop: 4,
                                                                                                                                                                                      },
                                                                                                                                                                                      bottomNavTextActive: {
                                                                                                                                                                                        fontWeight: 'bold',
                                                                                                                                                                                        // Color set directly in render based on page
                                                                                                                                                                                      },
                                                                                                                                                                                      badge: {
                                                                                                                                                                                        position: 'absolute',
                                                                                                                                                                                        top: -5,
                                                                                                                                                                                        right: 15,
                                                                                                                                                                                        backgroundColor: 'red',
                                                                                                                                                                                        borderRadius: 10,
                                                                                                                                                                                        width: 20,
                                                                                                                                                                                        height: 20,
                                                                                                                                                                                        justifyContent: 'center',
                                                                                                                                                                                        alignItems: 'center',
                                                                                                                                                                                        zIndex: 1, // Ensure badge is above icon
                                                                                                                                                                                      },
                                                                                                                                                                                      badgeText: {
                                                                                                                                                                                        color: 'white',
                                                                                                                                                                                        fontSize: 12,
                                                                                                                                                                                        fontWeight: 'bold',
                                                                                                                                                                                      },
                                                                                                                                                                                    });