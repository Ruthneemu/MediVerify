// server.js - MediVerify Backend with REAL Celo Integration

const express = require("express");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const { ethers } = require("ethers"); // Import Ethers.js
require("dotenv").config(); // Load environment variables for backend private key

// Initialize the Express application
const app = express();
const PORT = process.env.PORT || 5000;

// --- Celo Blockchain Configuration (REAL VALUES) ---
// Use the Celo Alfajores Testnet RPC URL
const CELO_RPC_URL = "https://alfajores-forno.celo-testnet.org"; // Public Celo Alfajores Testnet RPC

// >>> IMPORTANT: REPLACE THIS WITH THE ACTUAL ADDRESS OF YOUR DEPLOYED MediVerify CONTRACT <<<
const CONTRACT_ADDRESS = "0x50B55c14708820E14D3b430455b13514834e1565";

// >>> IMPORTANT: REPLACE THIS ENTIRE ARRAY WITH YOUR CONTRACT'S ABI! <<<
// Paste the full ABI array you copied from MediVerify.json here.
// It starts with [ and ends with ].
const CONTRACT_ABI = [
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "string",
        name: "qrCode",
        type: "string",
      },
      {
        indexed: false,
        internalType: "string",
        name: "drugName",
        type: "string",
      },
      {
        indexed: true,
        internalType: "address",
        name: "registeredBy",
        type: "address",
      },
    ],
    name: "DrugRegistered",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "string",
        name: "qrCode",
        type: "string",
      },
      {
        internalType: "string",
        name: "oldStatus",
        type: "string",
      },
      {
        internalType: "string",
        name: "newStatus",
        type: "string",
      },
      {
        indexed: true,
        internalType: "address",
        name: "updatedBy",
        type: "address",
      },
    ],
    name: "DrugStatusUpdated",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "string",
        name: "qrCode",
        type: "string",
      },
      {
        internalType: "string",
        name: "step",
        type: "string",
      },
      {
        internalType: "uint256",
        name: "timestamp",
        type: "uint256",
      },
    ],
    name: "SupplyChainStepAdded",
    type: "event",
  },
  {
    inputs: [
      {
        internalType: "string",
        name: "_qrCode",
        type: "string",
      },
      {
        internalType: "string",
        name: "_step",
        type: "string",
      },
    ],
    name: "addSupplyChainStep",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "string",
        name: "",
        type: "string",
      },
    ],
    name: "drugs",
    outputs: [
      {
        internalType: "string",
        name: "manufacturer",
        type: "string",
      },
      {
        internalType: "string",
        name: "drugName",
        type: "string",
      },
      {
        internalType: "string",
        name: "batchNumber",
        type: "string",
      },
      {
        internalType: "string",
        name: "expiryDate",
        type: "string",
      },
      {
        internalType: "string",
        name: "status",
        type: "string",
      },
      {
        internalType: "string",
        name: "description",
        type: "string",
      },
      {
        internalType: "bool",
        name: "exists",
        type: "bool",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "string",
        name: "_qrCode",
        type: "string",
      },
    ],
    name: "getDrugDetails",
    outputs: [
      {
        internalType: "string",
        name: "manufacturer",
        type: "string",
      },
      {
        internalType: "string",
        name: "drugName",
        type: "string",
      },
      {
        internalType: "string",
        name: "batchNumber",
        type: "string",
      },
      {
        internalType: "string",
        name: "expiryDate",
        type: "string",
      },
      {
        internalType: "string[]",
        name: "supplyChain",
        type: "string[]",
      },
      {
        internalType: "string",
        name: "status",
        type: "string",
      },
      {
        internalType: "string",
        name: "description",
        type: "string",
      },
      {
        internalType: "bool",
        name: "exists",
        type: "bool",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "string",
        name: "_qrCode",
        type: "string",
      },
      {
        internalType: "string",
        name: "_manufacturer",
        type: "string",
      },
      {
        internalType: "string",
        name: "_drugName",
        type: "string",
      },
      {
        internalType: "string",
        name: "_batchNumber",
        type: "string",
      },
      {
        internalType: "string",
        name: "_expiryDate",
        type: "string",
      },
      {
        internalType: "string",
        name: "_description",
        type: "string",
      },
    ],
    name: "registerDrugBatch",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "string",
        name: "_qrCode",
        type: "string",
      },
      {
        internalType: "string",
        name: "_newStatus",
        type: "string",
      },
    ],
    name: "updateDrugStatus",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
];

// Setup Ethers.js provider and contract instance
const provider = new ethers.JsonRpcProvider(CELO_RPC_URL);
const mediVerifyContract = new ethers.Contract(
  CONTRACT_ADDRESS,
  CONTRACT_ABI,
  provider,
);

// --- Wallet for sending transactions (e.g., for pharmacies/distributors) ---
// IMPORTANT: For a real app, never hardcode private keys. Use environment variables
// and secure key management practices (e.g., KMS, user wallets).
// This private key MUST correspond to a wallet funded with Alfajores CELO.
const PRIVATE_KEY = process.env.BACKEND_PRIVATE_KEY; // <<< IMPORTANT: Set this in your backend's .env file!
if (!PRIVATE_KEY) {
  console.error("BACKEND_PRIVATE_KEY not set in .env. Transactions will fail.");
  // process.exit(1); // Consider exiting if key is critical
}
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
const mediVerifyContractWithSigner = mediVerifyContract.connect(wallet);

// --- Middleware Setup ---
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configure Multer for file storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, "uploads");
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    cb(
      null,
      file.fieldname + "-" + Date.now() + path.extname(file.originalname),
    );
  },
});
const upload = multer({ storage: storage });

// --- API Endpoint for QR Code Verification (NOW INTERACTS WITH REAL CELO) ---
app.post("/api/verify-qr", async (req, res) => {
  const { qrCode } = req.body;
  console.log(`Received QR code for blockchain verification: ${qrCode}`);

  try {
    // Call the getDrugDetails function on your smart contract
    // This is a 'view' function, so it doesn't cost gas.
    const drugDetails = await mediVerifyContract.getDrugDetails(qrCode);

    // The 'exists' property from the Solidity struct indicates if a record was found
    if (drugDetails.exists) {
      // Map the blockchain response to a more readable format
      const drugRecord = {
        qrCode: qrCode,
        manufacturer: drugDetails.manufacturer,
        drugName: drugDetails.drugName,
        batchNumber: drugDetails.batchNumber,
        expiryDate: drugDetails.expiryDate,
        supplyChain: drugDetails.supplyChain,
        status: drugDetails.status,
        description: drugDetails.description,
      };
      console.log(`Drug record found for ${qrCode}:`, drugRecord);
      res.json({
        success: true,
        message: "Drug verified successfully from blockchain!",
        data: drugRecord,
      });
    } else {
      console.log(`No record found for QR code: ${qrCode} on blockchain.`);
      res.status(404).json({
        success: false,
        message:
          "Drug not found on blockchain or is counterfeit. Please check the QR code or report suspicious activity.",
        data: null,
      });
    }
  } catch (error) {
    console.error(
      "Error interacting with Celo blockchain for QR verification:",
      error,
    );
    res.status(500).json({
      success: false,
      message:
        "Failed to verify drug with blockchain. Please ensure the backend wallet has funds and the contract address/ABI are correct. Error: " +
        error.message,
      error: error.message,
    });
  }
});

// --- API Endpoint for AI Package Verification Simulation (unchanged) ---
app.post(
  "/api/verify-package-ai",
  upload.single("packageImage"),
  (req, res) => {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No image file uploaded.",
        data: null,
      });
    }
    console.log(`Received image for AI verification: ${req.file.filename}`);
    const simulatedResults = [
      {
        authenticity: "authentic",
        confidence: 0.98,
        details:
          "Packaging matches known genuine patterns. Logos and fonts appear correct.",
      },
      {
        authenticity: "counterfeit",
        confidence: 0.85,
        details:
          "Detected inconsistencies in packaging design, blurry text, or mismatched logos.",
      },
      {
        authenticity: "authentic",
        confidence: 0.92,
        details:
          "Minor wear and tear detected, but overall packaging characteristics align with genuine product.",
      },
      {
        authenticity: "counterfeit",
        confidence: 0.7,
        details:
          "Suspicious serialization or batch number format. Further investigation recommended.",
      },
    ];
    const randomResult =
      simulatedResults[Math.floor(Math.random() * simulatedResults.length)];
    setTimeout(() => {
      res.json({
        success: true,
        message: `AI package verification complete. Status: ${randomResult.authenticity.toUpperCase()}`,
        data: randomResult,
      });
    }, 1500);
  },
);

// --- API Endpoint for SMS Verification Webhook (NOW INTERACTS WITH REAL CELO) ---
app.post("/api/sms-webhook", async (req, res) => {
  console.log("Incoming SMS Webhook Request Body:", req.body);
  const smsMessage = req.body.text || req.body.Body || "";
  const senderNumber = req.body.from || req.body.From || "unknown";
  console.log(`SMS received from ${senderNumber}: "${smsMessage}"`);

  let responseMessage =
    "MediVerify: Invalid format. Text VERIFY <drug_code> to check authenticity.";

  const parts = smsMessage.trim().toUpperCase().split(" ");
  if (parts.length >= 2 && parts[0] === "VERIFY") {
    const qrCode = parts[1];

    try {
      const drugDetails = await mediVerifyContract.getDrugDetails(qrCode);

      if (drugDetails.exists) {
        if (drugDetails.status === "authentic") {
          responseMessage = `MediVerify: AUTHENTIC! ${drugDetails.drugName}, Mfg: ${drugDetails.manufacturer}, Exp: ${drugDetails.expiryDate}.`;
        } else if (drugDetails.status === "authentic (expired)") {
          responseMessage = `MediVerify: AUTHENTIC but EXPIRED! ${drugDetails.drugName}, Mfg: ${drugDetails.manufacturer}, Exp: ${drugDetails.expiryDate}. DO NOT USE.`;
        } else if (drugDetails.status === "counterfeit") {
          responseMessage = `MediVerify: COUNTERFEIT ALERT! ${drugDetails.drugName} is likely fake. Do NOT use. Report to NAFDAC/PCN.`;
        }
      } else {
        responseMessage = `MediVerify: Drug code "${qrCode}" not found on blockchain. Could be counterfeit or unlisted.`;
      }
    } catch (error) {
      console.error(
        "Error interacting with Celo blockchain for SMS verification:",
        error,
      );
      responseMessage =
        "MediVerify: Error verifying drug. Please try again later.";
    }
  }

  res.set("Content-Type", "text/plain");
  res.send(responseMessage);
  console.log(`SMS response sent to ${senderNumber}: "${responseMessage}"`);
});

// --- NEW API Endpoint for Registering Drugs (for Pharmacies/Distributors) ---
// This would be called by a separate frontend for pharmacies/distributors.
app.post("/api/register-drug", async (req, res) => {
  const {
    qrCode,
    manufacturer,
    drugName,
    batchNumber,
    expiryDate,
    description,
  } = req.body;

  if (
    !qrCode ||
    !manufacturer ||
    !drugName ||
    !batchNumber ||
    !expiryDate ||
    !description
  ) {
    return res
      .status(400)
      .json({ success: false, message: "All fields are required." });
  }

  try {
    // Send a transaction to the blockchain to register the drug
    // This requires a wallet with funds (CELO) to pay for gas.
    const tx = await mediVerifyContractWithSigner.registerDrugBatch(
      qrCode,
      manufacturer,
      drugName,
      batchNumber,
      expiryDate,
      description,
    );
    await tx.wait(); // Wait for the transaction to be mined

    console.log(
      `Drug registered on blockchain: ${qrCode} with transaction hash: ${tx.hash}`,
    );
    res.json({
      success: true,
      message: "Drug batch registered on blockchain successfully!",
      transactionHash: tx.hash,
    });
  } catch (error) {
    console.error("Error registering drug on blockchain:", error);
    res.status(500).json({
      success: false,
      message:
        "Failed to register drug on blockchain. It might already exist or there was a network error. Error: " +
        error.message,
      error: error.message,
    });
  }
});

// --- NEW API Endpoint for Adding Supply Chain Steps ---
app.post("/api/add-supply-step", async (req, res) => {
  const { qrCode, step } = req.body;

  if (!qrCode || !step) {
    return res
      .status(400)
      .json({ success: false, message: "QR code and step are required." });
  }

  try {
    const tx = await mediVerifyContractWithSigner.addSupplyChainStep(
      qrCode,
      step,
    );
    await tx.wait();

    console.log(
      `Supply chain step added for ${qrCode}: ${step}, Transaction: ${tx.hash}`,
    );
    res.json({
      success: true,
      message: "Supply chain step added successfully!",
      transactionHash: tx.hash,
    });
  } catch (error) {
    console.error("Error adding supply chain step:", error);
    res.status(500).json({
      success: false,
      message:
        "Failed to add supply chain step. Ensure drug exists and wallet has funds. Error: " +
        error.message,
      error: error.message,
    });
  }
});

// --- NEW API Endpoint for Updating Drug Status ---
app.post("/api/update-drug-status", async (req, res) => {
  const { qrCode, newStatus } = req.body;

  if (!qrCode || !newStatus) {
    return res.status(400).json({
      success: false,
      message: "QR code and new status are required.",
    });
  }

  try {
    const tx = await mediVerifyContractWithSigner.updateDrugStatus(
      qrCode,
      newStatus,
    );
    await tx.wait();

    console.log(
      `Drug status updated for ${qrCode} to ${newStatus}, Transaction: ${tx.hash}`,
    );
    res.json({
      success: true,
      message: "Drug status updated successfully!",
      transactionHash: tx.hash,
    });
  } catch (error) {
    console.error("Error updating drug status:", error);
    res.status(500).json({
      success: false,
      message:
        "Failed to update drug status. Ensure drug exists and wallet has funds. Error: " +
        error.message,
      error: error.message,
    });
  }
});

// --- Basic Root Route ---
app.get("/", (req, res) => {
  res.send(
    "MediVerify Backend is running! Access /api/verify-qr for web QR, /api/verify-package-ai for AI, /api/sms-webhook for SMS, /api/register-drug for blockchain registration, /api/add-supply-step, and /api/update-drug-status.",
  );
});

// --- Start the Server ---
app.listen(PORT, () => {
  console.log(`MediVerify Backend server running on port ${PORT}`);
  console.log(`Access it at http://localhost:${PORT}`);
});
