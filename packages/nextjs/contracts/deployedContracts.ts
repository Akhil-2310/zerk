import { GenericContractsDeclaration } from "~~/utils/helper/contract";

const deployedContracts = {
  11155111: {
    ConfidentialPredictionMarket: {
      address: "0xa5992143C81fbAd3Bbe55060B1473e587E633a01",
      abi: [
      {
            "inputs": [
                  {
                        "internalType": "address",
                        "name": "_btcFeed",
                        "type": "address"
                  },
                  {
                        "internalType": "address",
                        "name": "_ethFeed",
                        "type": "address"
                  }
            ],
            "stateMutability": "nonpayable",
            "type": "constructor"
      },
      {
            "inputs": [],
            "name": "InvalidKMSSignatures",
            "type": "error"
      },
      {
            "inputs": [
                  {
                        "internalType": "bytes32",
                        "name": "handle",
                        "type": "bytes32"
                  },
                  {
                        "internalType": "address",
                        "name": "sender",
                        "type": "address"
                  }
            ],
            "name": "SenderNotAllowedToUseHandle",
            "type": "error"
      },
      {
            "inputs": [],
            "name": "ZamaProtocolUnsupported",
            "type": "error"
      },
      {
            "anonymous": false,
            "inputs": [
                  {
                        "indexed": true,
                        "internalType": "uint256",
                        "name": "marketId",
                        "type": "uint256"
                  },
                  {
                        "indexed": true,
                        "internalType": "address",
                        "name": "user",
                        "type": "address"
                  },
                  {
                        "indexed": false,
                        "internalType": "enum ConfidentialPredictionMarket.AssetType",
                        "name": "assetType",
                        "type": "uint8"
                  }
            ],
            "name": "BetPlaced",
            "type": "event"
      },
      {
            "anonymous": false,
            "inputs": [
                  {
                        "indexed": true,
                        "internalType": "uint256",
                        "name": "marketId",
                        "type": "uint256"
                  },
                  {
                        "indexed": true,
                        "internalType": "address",
                        "name": "user",
                        "type": "address"
                  },
                  {
                        "indexed": false,
                        "internalType": "bytes32",
                        "name": "winHandle",
                        "type": "bytes32"
                  }
            ],
            "name": "ClaimPrepared",
            "type": "event"
      },
      {
            "anonymous": false,
            "inputs": [
                  {
                        "indexed": true,
                        "internalType": "uint256",
                        "name": "marketId",
                        "type": "uint256"
                  },
                  {
                        "indexed": true,
                        "internalType": "address",
                        "name": "user",
                        "type": "address"
                  }
            ],
            "name": "Claimed",
            "type": "event"
      },
      {
            "anonymous": false,
            "inputs": [
                  {
                        "indexed": true,
                        "internalType": "uint256",
                        "name": "id",
                        "type": "uint256"
                  },
                  {
                        "indexed": false,
                        "internalType": "enum ConfidentialPredictionMarket.MarketType",
                        "name": "marketType",
                        "type": "uint8"
                  },
                  {
                        "indexed": false,
                        "internalType": "enum ConfidentialPredictionMarket.AssetType",
                        "name": "assetType",
                        "type": "uint8"
                  },
                  {
                        "indexed": false,
                        "internalType": "uint256",
                        "name": "strikePrice",
                        "type": "uint256"
                  },
                  {
                        "indexed": false,
                        "internalType": "uint256",
                        "name": "resolveTime",
                        "type": "uint256"
                  }
            ],
            "name": "MarketCreated",
            "type": "event"
      },
      {
            "anonymous": false,
            "inputs": [
                  {
                        "indexed": true,
                        "internalType": "uint256",
                        "name": "id",
                        "type": "uint256"
                  },
                  {
                        "indexed": false,
                        "internalType": "bool",
                        "name": "outcome",
                        "type": "bool"
                  },
                  {
                        "indexed": false,
                        "internalType": "int256",
                        "name": "price",
                        "type": "int256"
                  }
            ],
            "name": "MarketResolved",
            "type": "event"
      },
      {
            "anonymous": false,
            "inputs": [
                  {
                        "indexed": false,
                        "internalType": "bytes32[]",
                        "name": "handlesList",
                        "type": "bytes32[]"
                  },
                  {
                        "indexed": false,
                        "internalType": "bytes",
                        "name": "abiEncodedCleartexts",
                        "type": "bytes"
                  }
            ],
            "name": "PublicDecryptionVerified",
            "type": "event"
      },
      {
            "anonymous": false,
            "inputs": [
                  {
                        "indexed": true,
                        "internalType": "uint256",
                        "name": "id",
                        "type": "uint256"
                  },
                  {
                        "indexed": false,
                        "internalType": "uint64",
                        "name": "totalPool",
                        "type": "uint64"
                  },
                  {
                        "indexed": false,
                        "internalType": "uint64",
                        "name": "winningPool",
                        "type": "uint64"
                  }
            ],
            "name": "TotalsDecrypted",
            "type": "event"
      },
      {
            "inputs": [
                  {
                        "internalType": "uint256",
                        "name": "",
                        "type": "uint256"
                  },
                  {
                        "internalType": "address",
                        "name": "",
                        "type": "address"
                  }
            ],
            "name": "bets",
            "outputs": [
                  {
                        "internalType": "euint64",
                        "name": "amount",
                        "type": "bytes32"
                  },
                  {
                        "internalType": "ebool",
                        "name": "side",
                        "type": "bytes32"
                  },
                  {
                        "internalType": "uint256",
                        "name": "ethAmount",
                        "type": "uint256"
                  },
                  {
                        "internalType": "bool",
                        "name": "hasBet",
                        "type": "bool"
                  },
                  {
                        "internalType": "bool",
                        "name": "claimed",
                        "type": "bool"
                  },
                  {
                        "internalType": "ebool",
                        "name": "winResult",
                        "type": "bytes32"
                  },
                  {
                        "internalType": "bool",
                        "name": "prepared",
                        "type": "bool"
                  }
            ],
            "stateMutability": "view",
            "type": "function"
      },
      {
            "inputs": [],
            "name": "btcFeed",
            "outputs": [
                  {
                        "internalType": "contract AggregatorV3Interface",
                        "name": "",
                        "type": "address"
                  }
            ],
            "stateMutability": "view",
            "type": "function"
      },
      {
            "inputs": [
                  {
                        "internalType": "uint256",
                        "name": "id",
                        "type": "uint256"
                  },
                  {
                        "internalType": "bytes",
                        "name": "abiEncodedCleartexts",
                        "type": "bytes"
                  },
                  {
                        "internalType": "bytes",
                        "name": "decryptionProof",
                        "type": "bytes"
                  }
            ],
            "name": "claimETH",
            "outputs": [],
            "stateMutability": "nonpayable",
            "type": "function"
      },
      {
            "inputs": [
                  {
                        "internalType": "uint256",
                        "name": "id",
                        "type": "uint256"
                  }
            ],
            "name": "claimToken",
            "outputs": [],
            "stateMutability": "nonpayable",
            "type": "function"
      },
      {
            "inputs": [],
            "name": "confidentialProtocolId",
            "outputs": [
                  {
                        "internalType": "uint256",
                        "name": "",
                        "type": "uint256"
                  }
            ],
            "stateMutability": "view",
            "type": "function"
      },
      {
            "inputs": [
                  {
                        "internalType": "enum ConfidentialPredictionMarket.MarketType",
                        "name": "marketType",
                        "type": "uint8"
                  },
                  {
                        "internalType": "uint256",
                        "name": "strikePrice",
                        "type": "uint256"
                  },
                  {
                        "internalType": "uint256",
                        "name": "resolveTime",
                        "type": "uint256"
                  },
                  {
                        "internalType": "uint256",
                        "name": "seedYes",
                        "type": "uint256"
                  },
                  {
                        "internalType": "uint256",
                        "name": "seedNo",
                        "type": "uint256"
                  }
            ],
            "name": "createMarketETH",
            "outputs": [],
            "stateMutability": "payable",
            "type": "function"
      },
      {
            "inputs": [
                  {
                        "internalType": "enum ConfidentialPredictionMarket.MarketType",
                        "name": "marketType",
                        "type": "uint8"
                  },
                  {
                        "internalType": "address",
                        "name": "token",
                        "type": "address"
                  },
                  {
                        "internalType": "uint256",
                        "name": "strikePrice",
                        "type": "uint256"
                  },
                  {
                        "internalType": "uint256",
                        "name": "resolveTime",
                        "type": "uint256"
                  },
                  {
                        "internalType": "externalEuint64",
                        "name": "seedYes",
                        "type": "bytes32"
                  },
                  {
                        "internalType": "externalEuint64",
                        "name": "seedNo",
                        "type": "bytes32"
                  },
                  {
                        "internalType": "bytes",
                        "name": "proof",
                        "type": "bytes"
                  }
            ],
            "name": "createMarketToken",
            "outputs": [],
            "stateMutability": "nonpayable",
            "type": "function"
      },
      {
            "inputs": [],
            "name": "ethFeed",
            "outputs": [
                  {
                        "internalType": "contract AggregatorV3Interface",
                        "name": "",
                        "type": "address"
                  }
            ],
            "stateMutability": "view",
            "type": "function"
      },
      {
            "inputs": [],
            "name": "feeBps",
            "outputs": [
                  {
                        "internalType": "uint256",
                        "name": "",
                        "type": "uint256"
                  }
            ],
            "stateMutability": "view",
            "type": "function"
      },
      {
            "inputs": [
                  {
                        "internalType": "uint256",
                        "name": "id",
                        "type": "uint256"
                  }
            ],
            "name": "getTotalHandles",
            "outputs": [
                  {
                        "internalType": "bytes32",
                        "name": "yesHandle",
                        "type": "bytes32"
                  },
                  {
                        "internalType": "bytes32",
                        "name": "noHandle",
                        "type": "bytes32"
                  }
            ],
            "stateMutability": "view",
            "type": "function"
      },
      {
            "inputs": [
                  {
                        "internalType": "uint256",
                        "name": "id",
                        "type": "uint256"
                  },
                  {
                        "internalType": "address",
                        "name": "user",
                        "type": "address"
                  }
            ],
            "name": "getWinHandle",
            "outputs": [
                  {
                        "internalType": "bytes32",
                        "name": "",
                        "type": "bytes32"
                  }
            ],
            "stateMutability": "view",
            "type": "function"
      },
      {
            "inputs": [],
            "name": "marketCount",
            "outputs": [
                  {
                        "internalType": "uint256",
                        "name": "",
                        "type": "uint256"
                  }
            ],
            "stateMutability": "view",
            "type": "function"
      },
      {
            "inputs": [
                  {
                        "internalType": "uint256",
                        "name": "",
                        "type": "uint256"
                  }
            ],
            "name": "markets",
            "outputs": [
                  {
                        "internalType": "enum ConfidentialPredictionMarket.AssetType",
                        "name": "assetType",
                        "type": "uint8"
                  },
                  {
                        "internalType": "enum ConfidentialPredictionMarket.MarketType",
                        "name": "marketType",
                        "type": "uint8"
                  },
                  {
                        "internalType": "address",
                        "name": "token",
                        "type": "address"
                  },
                  {
                        "internalType": "uint256",
                        "name": "strikePrice",
                        "type": "uint256"
                  },
                  {
                        "internalType": "uint256",
                        "name": "resolveTime",
                        "type": "uint256"
                  },
                  {
                        "internalType": "bool",
                        "name": "resolved",
                        "type": "bool"
                  },
                  {
                        "internalType": "bool",
                        "name": "outcome",
                        "type": "bool"
                  },
                  {
                        "internalType": "euint64",
                        "name": "totalYes",
                        "type": "bytes32"
                  },
                  {
                        "internalType": "euint64",
                        "name": "totalNo",
                        "type": "bytes32"
                  },
                  {
                        "internalType": "uint64",
                        "name": "totalPoolPlain",
                        "type": "uint64"
                  },
                  {
                        "internalType": "uint64",
                        "name": "winningPoolPlain",
                        "type": "uint64"
                  },
                  {
                        "internalType": "bool",
                        "name": "totalsReady",
                        "type": "bool"
                  }
            ],
            "stateMutability": "view",
            "type": "function"
      },
      {
            "inputs": [],
            "name": "owner",
            "outputs": [
                  {
                        "internalType": "address",
                        "name": "",
                        "type": "address"
                  }
            ],
            "stateMutability": "view",
            "type": "function"
      },
      {
            "inputs": [
                  {
                        "internalType": "uint256",
                        "name": "id",
                        "type": "uint256"
                  },
                  {
                        "internalType": "externalEbool",
                        "name": "side",
                        "type": "bytes32"
                  },
                  {
                        "internalType": "bytes",
                        "name": "proof",
                        "type": "bytes"
                  }
            ],
            "name": "placeBetETH",
            "outputs": [],
            "stateMutability": "payable",
            "type": "function"
      },
      {
            "inputs": [
                  {
                        "internalType": "uint256",
                        "name": "id",
                        "type": "uint256"
                  },
                  {
                        "internalType": "externalEuint64",
                        "name": "amount",
                        "type": "bytes32"
                  },
                  {
                        "internalType": "externalEbool",
                        "name": "side",
                        "type": "bytes32"
                  },
                  {
                        "internalType": "bytes",
                        "name": "proof",
                        "type": "bytes"
                  }
            ],
            "name": "placeBetToken",
            "outputs": [],
            "stateMutability": "nonpayable",
            "type": "function"
      },
      {
            "inputs": [
                  {
                        "internalType": "uint256",
                        "name": "id",
                        "type": "uint256"
                  }
            ],
            "name": "prepareClaimETH",
            "outputs": [],
            "stateMutability": "nonpayable",
            "type": "function"
      },
      {
            "inputs": [
                  {
                        "internalType": "uint256",
                        "name": "id",
                        "type": "uint256"
                  }
            ],
            "name": "resolveMarket",
            "outputs": [],
            "stateMutability": "nonpayable",
            "type": "function"
      },
      {
            "inputs": [
                  {
                        "internalType": "uint256",
                        "name": "id",
                        "type": "uint256"
                  },
                  {
                        "internalType": "bytes",
                        "name": "abiEncodedCleartexts",
                        "type": "bytes"
                  },
                  {
                        "internalType": "bytes",
                        "name": "decryptionProof",
                        "type": "bytes"
                  }
            ],
            "name": "submitTotals",
            "outputs": [],
            "stateMutability": "nonpayable",
            "type": "function"
      },
      {
            "inputs": [],
            "name": "withdrawFees",
            "outputs": [],
            "stateMutability": "nonpayable",
            "type": "function"
      },
      {
            "stateMutability": "payable",
            "type": "receive"
      }
],
    },
  },
} as const;

export default deployedContracts satisfies GenericContractsDeclaration;
