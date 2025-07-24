// App.js - MediVerify Mobile Application

import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  Image,
  ScrollView,
  ActivityIndicator,
  Alert, // Using Alert for simple messages as per instructions
  Platform, // To check platform for permissions
} from "react-native";
import { Camera } from "expo-camera"; // For QR scanning
import { BarCodeScanner } from "expo-barcode-scanner"; // For QR scanning
import * as ImagePicker from "expo-image-picker"; // For picking images for AI verification
import { styled } from "nativewind"; // For Tailwind CSS

// Styled components for NativeWind
const StyledView = styled(View);
const StyledText = styled(Text);
const StyledTouchableOpacity = styled(TouchableOpacity);
const StyledTextInput = styled(TextInput);
const StyledImage = styled(Image);
const StyledScrollView = styled(ScrollView);
const StyledActivityIndicator = styled(ActivityIndicator);

// >>> IMPORTANT: REPLACE WITH YOUR ACTUAL REPLIT BACKEND URL <<<
// Example: const BACKEND_URL = 'https://your-replit-username-mediverify-backend.replit.dev';
const BACKEND_URL =
  "https://07ecd53a-4463-400d-a252-37769a5e9e7f-00-1fva6us9oqckd.spock.replit.dev/"; // <--- PASTE YOUR BACKEND URL HERE!

export default function App() {
  const [cameraPermission, setCameraPermission] = useState(null);
  const [imagePickerPermission, setImagePickerPermission] = useState(null);
  const [scannedData, setScannedData] = useState(""); // Stores manually entered QR or scanned QR
  const [drugDetails, setDrugDetails] = useState(null);
  const [scanned, setScanned] = useState(false); // To prevent multiple scans
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);
  const [aiVerificationResult, setAiVerificationResult] = useState(null);
  const [isScanning, setIsScanning] = useState(false); // Controls camera view visibility

  // Request permissions on component mount
  useEffect(() => {
    (async () => {
      // Camera permission
      const cameraStatus = await Camera.requestCameraPermissionsAsync();
      setCameraPermission(cameraStatus.status === "granted");

      // Image picker permission (for gallery access)
      if (Platform.OS !== "web") {
        // Image picker is not typically used on web for native apps
        const imagePickerStatus =
          await ImagePicker.requestMediaLibraryPermissionsAsync();
        setImagePickerPermission(imagePickerStatus.status === "granted");
      }
    })();
  }, []);

  // Handler for QR code scanned by camera
  const handleBarCodeScanned = ({ type, data }) => {
    setScanned(true); // Mark as scanned to prevent re-scanning immediately
    setIsScanning(false); // Hide camera view
    setScannedData(data); // Set the scanned data to the input field
    Alert.alert("QR Code Scanned!", `Type: ${type}\nData: ${data}`, [
      { text: "OK", onPress: () => verifyQrCode(data) }, // Automatically verify after scan
    ]);
  };

  // Function to verify QR code with the backend
  const verifyQrCode = async (qrCodeToVerify) => {
    setLoading(true);
    setError(null);
    setDrugDetails(null); // Clear previous details
    setAiVerificationResult(null); // Clear AI results

    try {
      const response = await fetch(`${BACKEND_URL}/api/verify-qr`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ qrCode: qrCodeToVerify }),
      });

      const result = await response.json();

      if (result.success) {
        setDrugDetails(result.data);
        Alert.alert("Verification Success", result.message);
      } else {
        setError(result.message);
        Alert.alert("Verification Failed", result.message);
      }
    } catch (err) {
      console.error("Error verifying QR code:", err);
      setError("Network error or backend is unreachable. Please try again.");
      Alert.alert(
        "Error",
        "Could not connect to the backend server. Please ensure it is running.",
      );
    } finally {
      setLoading(false);
      setScanned(false); // Reset scanned state for next scan
    }
  };

  // Function to pick an image from the device's library
  const pickImage = async () => {
    if (!imagePickerPermission) {
      Alert.alert(
        "Permission Required",
        "Media library permission is needed to pick images.",
      );
      return;
    }

    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 1,
      base64: false, // We'll send as multipart/form-data
    });

    if (!result.canceled) {
      setSelectedImage(result.assets[0].uri);
      setAiVerificationResult(null); // Clear previous AI results
      // Optionally, automatically verify after picking
      // verifyPackageAI(result.assets[0].uri);
    }
  };

  // Function to send image for AI verification
  const verifyPackageAI = async (imageUri) => {
    if (!imageUri) {
      Alert.alert("No Image", "Please select an image first.");
      return;
    }

    setLoading(true);
    setError(null);
    setDrugDetails(null); // Clear previous details
    setAiVerificationResult(null); // Clear previous AI results

    const formData = new FormData();
    formData.append("packageImage", {
      uri: imageUri,
      name: "package.jpg",
      type: "image/jpeg",
    });

    try {
      const response = await fetch(`${BACKEND_URL}/api/verify-package-ai`, {
        method: "POST",
        headers: {
          // 'Content-Type': 'multipart/form-data' is automatically set by FormData
        },
        body: formData,
      });

      const result = await response.json();

      if (result.success) {
        setAiVerificationResult(result.data);
        Alert.alert("AI Verification Success", result.message);
      } else {
        setError(result.message);
        Alert.alert("AI Verification Failed", result.message);
      }
    } catch (err) {
      console.error("Error verifying package with AI:", err);
      setError(
        "Network error or backend is unreachable for AI verification. Please try again.",
      );
      Alert.alert(
        "Error",
        "Could not connect to the backend for AI verification.",
      );
    } finally {
      setLoading(false);
    }
  };

  // Render permission status
  if (
    cameraPermission === null ||
    (Platform.OS !== "web" && imagePickerPermission === null)
  ) {
    return (
      <StyledView className="flex-1 justify-center items-center bg-gray-100 p-4">
        <StyledActivityIndicator size="large" color="#4CAF50" />
        <StyledText className="mt-4 text-lg text-gray-700">
          Requesting permissions...
        </StyledText>
      </StyledView>
    );
  }

  if (cameraPermission === false) {
    return (
      <StyledView className="flex-1 justify-center items-center bg-red-100 p-4">
        <StyledText className="text-xl font-bold text-red-700">
          Camera access denied
        </StyledText>
        <StyledText className="mt-2 text-base text-red-600 text-center">
          Please enable camera permissions in your device settings to use QR
          scanning.
        </StyledText>
      </StyledView>
    );
  }

  if (Platform.OS !== "web" && imagePickerPermission === false) {
    return (
      <StyledView className="flex-1 justify-center items-center bg-red-100 p-4">
        <StyledText className="text-xl font-bold text-red-700">
          Media Library access denied
        </StyledText>
        <StyledText className="mt-2 text-base text-red-600 text-center">
          Please enable media library permissions in your device settings to use
          AI image verification.
        </StyledText>
      </StyledView>
    );
  }

  return (
    <StyledScrollView className="flex-1 bg-gray-50 p-6 pt-12">
      <StyledText className="text-3xl font-extrabold text-green-700 mb-8 text-center">
        MediVerify Mobile
      </StyledText>

      {/* QR Code Verification Section */}
      <StyledView className="bg-white rounded-xl shadow-lg p-6 mb-8">
        <StyledText className="text-2xl font-semibold text-gray-800 mb-4">
          QR Code Verification
        </StyledText>

        {/* Camera Scanner */}
        {isScanning && (
          <StyledView className="w-full h-64 bg-gray-300 rounded-lg overflow-hidden mb-4">
            <Camera
              onBarCodeScanned={scanned ? undefined : handleBarCodeScanned}
              style={{ flex: 1 }}
              barCodeScannerSettings={{
                barCodeTypes: [BarCodeScanner.Constants.BarCodeType.qr],
              }}
            />
            <StyledText className="absolute bottom-4 w-full text-center text-white text-lg font-bold">
              Scan a QR Code
            </StyledText>
          </StyledView>
        )}

        <StyledTouchableOpacity
          onPress={() => setIsScanning(!isScanning)}
          className="bg-blue-600 p-4 rounded-lg mb-4 shadow-md items-center"
        >
          <StyledText className="text-white text-lg font-bold">
            {isScanning ? "Stop Scanning" : "Start QR Scanner"}
          </StyledText>
        </StyledTouchableOpacity>

        <StyledText className="text-lg text-gray-700 mb-2">
          Or enter QR Code manually:
        </StyledText>
        <StyledTextInput
          className="border border-gray-300 p-3 rounded-lg text-lg mb-4 bg-white"
          placeholder="Enter QR Code"
          value={scannedData}
          onChangeText={setScannedData}
        />
        <StyledTouchableOpacity
          onPress={() => verifyQrCode(scannedData)}
          className="bg-green-600 p-4 rounded-lg shadow-md items-center"
          disabled={loading || !scannedData}
        >
          {loading && !aiVerificationResult ? (
            <StyledActivityIndicator color="#fff" />
          ) : (
            <StyledText className="text-white text-lg font-bold">
              Verify QR Code
            </StyledText>
          )}
        </StyledTouchableOpacity>
      </StyledView>

      {/* AI Package Verification Section */}
      <StyledView className="bg-white rounded-xl shadow-lg p-6 mb-8">
        <StyledText className="text-2xl font-semibold text-gray-800 mb-4">
          AI Package Verification
        </StyledText>
        {selectedImage && (
          <StyledImage
            source={{ uri: selectedImage }}
            className="w-full h-48 rounded-lg mb-4"
            resizeMode="contain"
          />
        )}
        <StyledTouchableOpacity
          onPress={pickImage}
          className="bg-purple-600 p-4 rounded-lg mb-4 shadow-md items-center"
        >
          <StyledText className="text-white text-lg font-bold">
            Pick Image from Gallery
          </StyledText>
        </StyledTouchableOpacity>
        <StyledTouchableOpacity
          onPress={() => verifyPackageAI(selectedImage)}
          className="bg-orange-600 p-4 rounded-lg shadow-md items-center"
          disabled={loading || !selectedImage}
        >
          {loading && !drugDetails ? (
            <StyledActivityIndicator color="#fff" />
          ) : (
            <StyledText className="text-white text-lg font-bold">
              Analyze Package with AI
            </StyledText>
          )}
        </StyledTouchableOpacity>
        {aiVerificationResult && (
          <StyledView className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <StyledText className="text-lg font-bold text-blue-800 mb-2">
              AI Analysis Result:
            </StyledText>
            <StyledText className="text-base text-blue-700">
              Authenticity:{" "}
              <StyledText className="font-bold">
                {aiVerificationResult.authenticity.toUpperCase()}
              </StyledText>
            </StyledText>
            <StyledText className="text-base text-blue-700">
              Confidence: {Math.round(aiVerificationResult.confidence * 100)}%
            </StyledText>
            <StyledText className="text-base text-blue-700">
              Details: {aiVerificationResult.details}
            </StyledText>
          </StyledView>
        )}
      </StyledView>

      {/* Verification Results Display */}
      {loading && (
        <StyledView className="flex-row items-center justify-center p-4 bg-yellow-100 rounded-lg shadow-md mb-8">
          <StyledActivityIndicator size="small" color="#FFA500" />
          <StyledText className="ml-2 text-lg text-yellow-800">
            Verifying...
          </StyledText>
        </StyledView>
      )}

      {error && (
        <StyledView className="p-4 bg-red-100 rounded-lg border border-red-300 mb-8">
          <StyledText className="text-red-700 font-bold text-lg">
            Error:
          </StyledText>
          <StyledText className="text-red-600 mt-1">{error}</StyledText>
        </StyledView>
      )}

      {drugDetails && (
        <StyledView className="bg-white rounded-xl shadow-lg p-6 mb-8 border-l-4 border-green-500">
          <StyledText className="text-2xl font-bold text-green-700 mb-4">
            Drug Details
          </StyledText>
          <StyledText className="text-lg text-gray-800 mb-2">
            <StyledText className="font-semibold">QR Code:</StyledText>{" "}
            {drugDetails.qrCode}
          </StyledText>
          <StyledText className="text-lg text-gray-800 mb-2">
            <StyledText className="font-semibold">Drug Name:</StyledText>{" "}
            {drugDetails.drugName}
          </StyledText>
          <StyledText className="text-lg text-gray-800 mb-2">
            <StyledText className="font-semibold">Manufacturer:</StyledText>{" "}
            {drugDetails.manufacturer}
          </StyledText>
          <StyledText className="text-lg text-gray-800 mb-2">
            <StyledText className="font-semibold">Batch Number:</StyledText>{" "}
            {drugDetails.batchNumber}
          </StyledText>
          <StyledText className="text-lg text-gray-800 mb-2">
            <StyledText className="font-semibold">Expiry Date:</StyledText>{" "}
            {drugDetails.expiryDate}
          </StyledText>
          <StyledText className="text-lg text-gray-800 mb-2">
            <StyledText className="font-semibold">Status:</StyledText>
            <StyledText
              className={`font-bold ${drugDetails.status.includes("authentic") ? "text-green-600" : "text-red-600"}`}
            >
              {" "}
              {drugDetails.status.toUpperCase()}
            </StyledText>
          </StyledText>
          <StyledText className="text-lg text-gray-800 mb-2">
            <StyledText className="font-semibold">Description:</StyledText>{" "}
            {drugDetails.description}
          </StyledText>

          <StyledText className="text-xl font-semibold text-gray-800 mt-4 mb-2">
            Supply Chain:
          </StyledText>
          {drugDetails.supplyChain && drugDetails.supplyChain.length > 0 ? (
            drugDetails.supplyChain.map((step, index) => (
              <StyledText
                key={index}
                className="text-base text-gray-700 ml-4 mb-1"
              >
                • {step}
              </StyledText>
            ))
          ) : (
            <StyledText className="text-base text-gray-600 ml-4">
              No supply chain steps recorded.
            </StyledText>
          )}
        </StyledView>
      )}
    </StyledScrollView>
  );
}
