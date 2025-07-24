// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0; // Specifies the Solidity compiler version



/**

 * @title MediVerify

 * @dev A smart contract for tracking drug authenticity and supply chain on the Celo blockchain.

 * This contract allows manufacturers/distributors to register drug batches with unique QR codes,

 * add supply chain steps, and allows anyone to query drug details.

 */

contract MediVerify {



    // Struct to define the properties of a drug batch

    struct Drug {

        string manufacturer;

        string drugName;

        string batchNumber;

        string expiryDate; // Stored as a string (e.g., "YYYY-MM-DD")

        string[] supplyChain; // Dynamic array to store chronological supply chain steps

        string status; // e.g., "authentic", "counterfeit", "authentic (expired)"

        string description;

        bool exists; // Flag to indicate if a drug record exists for a given QR code

    }



    // Mapping to store Drug structs, indexed by their unique QR code string

    // This allows efficient lookup of drug details using the QR code.

    mapping(string => Drug) public drugs;



    // --- Events ---

    // Events are used to log actions on the blockchain. They are useful for off-chain

    // applications (like your Node.js backend) to listen for changes without constantly polling.



    // Emitted when a new drug batch is successfully registered

    event DrugRegistered(

        string indexed qrCode, // Indexed for easier searching in blockchain explorers

        string drugName,

        address indexed registeredBy // The address that registered the drug

    );



    // Emitted when a new supply chain step is added to a drug

    event SupplyChainStepAdded(

        string indexed qrCode,

        string step,

        uint256 timestamp

    );



    // Emitted when a drug's status is updated (e.g., marked counterfeit by a regulator)

    event DrugStatusUpdated(

        string indexed qrCode,

        string oldStatus,

        string newStatus,

        address indexed updatedBy

    );



    // --- Functions ---



    /**

     * @dev Registers a new drug batch on the blockchain.

     * Only a new drug (based on QR code) can be registered.

     * @param _qrCode The unique QR code string for the drug batch.

     * @param _manufacturer The name of the drug manufacturer.

     * @param _drugName The name of the drug.

     * @param _batchNumber The batch number of the drug.

     * @param _expiryDate The expiry date of the drug (e.g., "2025-12-31").

     * @param _description A brief description of the drug.

     */

    function registerDrugBatch(

        string memory _qrCode,

        string memory _manufacturer,

        string memory _drugName,

        string memory _batchNumber,

        string memory _expiryDate,

        string memory _description

    ) public {

        // Ensure a drug with this QR code does not already exist

        require(!drugs[_qrCode].exists, "Drug with this QR code already exists.");



        // Create a new Drug struct and store it in the mapping

        drugs[_qrCode] = Drug({

            manufacturer: _manufacturer,

            drugName: _drugName,

            batchNumber: _batchNumber,

            expiryDate: _expiryDate,

            supplyChain: new string[](0), // Initialize an empty array for supply chain steps

            status: "authentic", // Default status is 'authentic' upon registration

            description: _description,

            exists: true // Mark as existing

        });



        // Add the initial supply chain step (registration at factory/source)

        drugs[_qrCode].supplyChain.push(string(abi.encodePacked("Registered at factory by ", _manufacturer, " on ", _getDateString())));



        // Emit the DrugRegistered event

        emit DrugRegistered(_qrCode, _drugName, msg.sender);

    }



    /**

     * @dev Adds a new step to the supply chain for an existing drug.

     * @param _qrCode The unique QR code of the drug.

     * @param _step A description of the supply chain step (e.g., "Shipped to Lagos warehouse").

     */

    function addSupplyChainStep(string memory _qrCode, string memory _step) public {

        // Ensure the drug exists before adding a step

        require(drugs[_qrCode].exists, "Drug does not exist.");



        // Add the new step with current timestamp

        drugs[_qrCode].supplyChain.push(string(abi.encodePacked(_step, " on ", _getDateString())));



        // Emit the SupplyChainStepAdded event

        emit SupplyChainStepAdded(_qrCode, _step, block.timestamp);

    }



    /**

     * @dev Updates the status of a drug. This could be used by regulators or for quality control.

     * @param _qrCode The unique QR code of the drug.

     * @param _newStatus The new status (e.g., "counterfeit", "recalled", "authentic (expired)").

     */

    function updateDrugStatus(string memory _qrCode, string memory _newStatus) public {

        require(drugs[_qrCode].exists, "Drug does not exist.");

        string memory oldStatus = drugs[_qrCode].status;

        drugs[_qrCode].status = _newStatus;



        emit DrugStatusUpdated(_qrCode, oldStatus, _newStatus, msg.sender);

    }



    /**

     * @dev Retrieves all details of a drug given its QR code.

     * This is a `view` function, meaning it doesn't modify state and costs no gas to call.

     * @param _qrCode The unique QR code of the drug.

     * @return manufacturer The manufacturer's name.

     * @return drugName The drug's name.

     * @return batchNumber The drug's batch number.

     * @return expiryDate The drug's expiry date.

     * @return supplyChain An array of supply chain steps.

     * @return status The current authenticity status.

     * @return description The drug's description.

     * @return exists A boolean indicating if the drug record exists.

     */

    function getDrugDetails(string memory _qrCode)

        public

        view

        returns (

            string memory manufacturer,

            string memory drugName,

            string memory batchNumber,

            string memory expiryDate,

            string[] memory supplyChain,

            string memory status,

            string memory description,

            bool exists

        )

    {

        Drug storage drug = drugs[_qrCode];

        return (

            drug.manufacturer,

            drug.drugName,

            drug.batchNumber,

            drug.expiryDate,

            drug.supplyChain,

            drug.status,

            drug.description,

            drug.exists

        );

    }



    // Internal helper function to get current date as a string (simplified for blockchain)

    // Note: Blockchains don't have direct access to real-world dates.

    // This uses block.timestamp, which is seconds since epoch.

    // Converting to a human-readable date string on-chain is complex and gas-intensive.

    // For a real app, you'd convert block.timestamp to date in your backend/frontend.

    // Here, we'll just return a placeholder or simple timestamp.

    function _getDateString() internal view returns (string memory) {

        // A more robust solution would involve an oracle for real-world dates or

        // converting block.timestamp to a human-readable format off-chain.

        // For simplicity, we'll just return the timestamp as a string.

        return _uint2str(block.timestamp);

    }



    // Helper function to convert uint to string (basic, for timestamp)

    function _uint2str(uint _i) internal pure returns (string memory _uintAsString) {

        if (_i == 0) {

            return "0";

        }

        uint j = _i;

        uint len;

        while (j != 0) {

            len++;

            j /= 10;

        }

        bytes memory bstr = new bytes(len);

        uint k = len - 1;

        while (_i != 0) {

            bstr[k--] = bytes1(uint8(48 + _i % 10));

            _i /= 10;

        }

        return string(bstr);

    }

}

