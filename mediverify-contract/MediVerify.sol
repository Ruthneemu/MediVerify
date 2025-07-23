
// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0; // Specifies the Solidity compiler version



/**

 * @title MediVerify

 * ... (paste all your Solidity code here) ...

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

