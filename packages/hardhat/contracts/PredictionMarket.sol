// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {
    FHE,
    euint64,
    ebool,
    externalEuint64,
    externalEbool
} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

interface AggregatorV3Interface {
    function latestRoundData()
        external
        view
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        );
}

// ERC7984 Confidential Token interface (matches Zama's ConfidentialWrapper / cUSDCMock)
interface IConfidentialERC20 {
    function confidentialTransfer(
        address to,
        euint64 amount
    ) external returns (euint64);

    function confidentialTransferFrom(
        address from,
        address to,
        euint64 amount
    ) external returns (euint64);

    function isOperator(address holder, address spender) external view returns (bool);
}

contract ConfidentialPredictionMarket is ZamaEthereumConfig {

    // =========================
    // STORAGE
    // =========================

    address public owner;
    uint256 public marketCount;
    uint256 public feeBps = 200; // 2%

    bool private _locked;

    modifier nonReentrant() {
        require(!_locked, "REENTRANT");
        _locked = true;
        _;
        _locked = false;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "NOT_OWNER");
        _;
    }

    enum AssetType { ETH, CONFIDENTIAL }
    enum MarketType { BTC_PRICE, ETH_PRICE }

    struct Bet {
        euint64 amount;
        ebool side;
        uint256 ethAmount;
        bool hasBet;
        bool claimed;
        ebool winResult;
        bool prepared;
    }

    struct Market {
        AssetType assetType;
        MarketType marketType;
        address token;

        uint256 strikePrice;
        uint256 resolveTime;

        bool resolved;
        bool outcome;

        euint64 totalYes;
        euint64 totalNo;

        uint64 totalPoolPlain;
        uint64 winningPoolPlain;

        bool totalsReady;
    }

    mapping(uint256 => Market) public markets;
    mapping(uint256 => mapping(address => Bet)) public bets;

    AggregatorV3Interface public btcFeed;
    AggregatorV3Interface public ethFeed;

    // =========================
    // EVENTS
    // =========================

    event MarketCreated(uint256 indexed id, MarketType marketType, AssetType assetType, uint256 strikePrice, uint256 resolveTime);
    event BetPlaced(uint256 indexed marketId, address indexed user, AssetType assetType);
    event MarketResolved(uint256 indexed id, bool outcome, int256 price);
    event TotalsDecrypted(uint256 indexed id, uint64 totalPool, uint64 winningPool);
    event ClaimPrepared(uint256 indexed marketId, address indexed user, bytes32 winHandle);
    event Claimed(uint256 indexed marketId, address indexed user);

    // =========================
    // CONSTRUCTOR
    // =========================

    constructor(address _btcFeed, address _ethFeed) {
        owner = msg.sender;
        btcFeed = AggregatorV3Interface(_btcFeed);
        ethFeed = AggregatorV3Interface(_ethFeed);
    }

    receive() external payable {}

    // =========================
    // CREATE MARKET (ETH)
    // =========================

    function createMarketETH(
        MarketType marketType,
        uint256 strikePrice,
        uint256 resolveTime,
        uint256 seedYes,
        uint256 seedNo
    ) external payable onlyOwner {
        require(resolveTime > block.timestamp, "RESOLVE_IN_PAST");
        require(msg.value == seedYes + seedNo, "INVALID_ETH");
        require(seedYes > 0 && seedNo > 0, "ZERO_SEED");

        uint256 id = marketCount++;
        Market storage m = markets[id];

        m.assetType = AssetType.ETH;
        m.marketType = marketType;
        m.strikePrice = strikePrice;
        m.resolveTime = resolveTime;

        m.totalYes = FHE.asEuint64(uint64(seedYes));
        m.totalNo  = FHE.asEuint64(uint64(seedNo));

        FHE.allowThis(m.totalYes);
        FHE.allowThis(m.totalNo);

        emit MarketCreated(id, marketType, AssetType.ETH, strikePrice, resolveTime);
    }

    // =========================
    // CREATE MARKET (TOKEN)
    // =========================

    function createMarketToken(
        MarketType marketType,
        address token,
        uint256 strikePrice,
        uint256 resolveTime,
        externalEuint64 seedYes,
        externalEuint64 seedNo,
        bytes calldata proof
    ) external onlyOwner {
        require(resolveTime > block.timestamp, "RESOLVE_IN_PAST");
        require(token != address(0), "ZERO_TOKEN");

        uint256 id = marketCount++;
        Market storage m = markets[id];

        m.assetType = AssetType.CONFIDENTIAL;
        m.marketType = marketType;
        m.token = token;
        m.strikePrice = strikePrice;
        m.resolveTime = resolveTime;

        euint64 yesAmount = FHE.fromExternal(seedYes, proof);
        euint64 noAmount  = FHE.fromExternal(seedNo, proof);

        FHE.allowTransient(yesAmount, token);
        FHE.allowTransient(noAmount, token);
        IConfidentialERC20(token).confidentialTransferFrom(msg.sender, address(this), yesAmount);
        IConfidentialERC20(token).confidentialTransferFrom(msg.sender, address(this), noAmount);

        m.totalYes = yesAmount;
        m.totalNo  = noAmount;

        FHE.allowThis(m.totalYes);
        FHE.allowThis(m.totalNo);

        emit MarketCreated(id, marketType, AssetType.CONFIDENTIAL, strikePrice, resolveTime);
    }

    // =========================
    // PLACE BET (ETH)
    // =========================

    function placeBetETH(
        uint256 id,
        externalEbool side,
        bytes calldata proof
    ) external payable {
        require(id < marketCount, "INVALID_MARKET");
        require(msg.value > 0, "ZERO_BET");

        Market storage m = markets[id];
        require(m.assetType == AssetType.ETH, "NOT_ETH");
        require(!m.resolved, "ALREADY_RESOLVED");
        require(block.timestamp < m.resolveTime, "MARKET_CLOSED");

        ebool s = FHE.fromExternal(side, proof);
        euint64 encAmt = FHE.asEuint64(uint64(msg.value));

        Bet storage b = bets[id][msg.sender];
        require(!b.hasBet, "ALREADY_BET");

        b.hasBet = true;
        b.ethAmount = msg.value;
        b.amount = encAmt;
        b.side = s;

        m.totalYes = FHE.select(s, FHE.add(m.totalYes, encAmt), m.totalYes);
        m.totalNo  = FHE.select(s, m.totalNo, FHE.add(m.totalNo, encAmt));

        FHE.allowThis(m.totalYes);
        FHE.allowThis(m.totalNo);
        FHE.allowThis(b.amount);
        FHE.allowThis(b.side);
        FHE.allow(b.amount, msg.sender);
        FHE.allow(b.side, msg.sender);

        emit BetPlaced(id, msg.sender, AssetType.ETH);
    }

    // =========================
    // PLACE BET (TOKEN)
    // =========================

    function placeBetToken(
        uint256 id,
        externalEuint64 amount,
        externalEbool side,
        bytes calldata proof
    ) external {
        require(id < marketCount, "INVALID_MARKET");

        Market storage m = markets[id];
        require(m.assetType == AssetType.CONFIDENTIAL, "NOT_TOKEN");
        require(!m.resolved, "ALREADY_RESOLVED");
        require(block.timestamp < m.resolveTime, "MARKET_CLOSED");

        euint64 amt = FHE.fromExternal(amount, proof);
        ebool s = FHE.fromExternal(side, proof);

        FHE.allowTransient(amt, m.token);
        IConfidentialERC20(m.token).confidentialTransferFrom(msg.sender, address(this), amt);

        Bet storage b = bets[id][msg.sender];
        require(!b.hasBet, "ALREADY_BET");

        b.hasBet = true;
        b.amount = amt;
        b.side = s;

        m.totalYes = FHE.select(s, FHE.add(m.totalYes, amt), m.totalYes);
        m.totalNo  = FHE.select(s, m.totalNo, FHE.add(m.totalNo, amt));

        FHE.allowThis(m.totalYes);
        FHE.allowThis(m.totalNo);
        FHE.allowThis(b.amount);
        FHE.allowThis(b.side);
        FHE.allow(b.amount, msg.sender);
        FHE.allow(b.side, msg.sender);

        emit BetPlaced(id, msg.sender, AssetType.CONFIDENTIAL);
    }

    // =========================
    // RESOLVE MARKET
    // =========================
    // Owner resolves after resolveTime. Also marks totalYes/totalNo as
    // publicly decryptable so anyone can request decryption from the relayer.

    function resolveMarket(uint256 id) external onlyOwner {
        require(id < marketCount, "INVALID_MARKET");

        Market storage m = markets[id];
        require(block.timestamp >= m.resolveTime, "EARLY");
        require(!m.resolved, "DONE");

        (, int256 price,,,) = m.marketType == MarketType.BTC_PRICE
            ? btcFeed.latestRoundData()
            : ethFeed.latestRoundData();

        require(price > 0, "INVALID_PRICE");

        m.outcome = uint256(price) > m.strikePrice;
        m.resolved = true;

        FHE.allow(m.totalYes, msg.sender);
        FHE.allow(m.totalNo, msg.sender);

        FHE.makePubliclyDecryptable(m.totalYes);
        FHE.makePubliclyDecryptable(m.totalNo);

        emit MarketResolved(id, m.outcome, price);
    }

    // =========================
    // VIEW: get bytes32 handles for totalYes / totalNo
    // =========================

    function getTotalHandles(uint256 id) external view returns (bytes32 yesHandle, bytes32 noHandle) {
        Market storage m = markets[id];
        yesHandle = euint64.unwrap(m.totalYes);
        noHandle = euint64.unwrap(m.totalNo);
    }

    // =========================
    // SUBMIT DECRYPTED TOTALS
    // =========================
    // After resolveMarket the owner (or anyone) obtains the public decryption
    // proof for totalYes/totalNo from the KMS via the relayer SDK, then submits
    // the raw ABI-encoded cleartexts and the proof here for on-chain verification.

    function submitTotals(
        uint256 id,
        bytes calldata abiEncodedCleartexts,
        bytes calldata decryptionProof
    ) external {
        require(id < marketCount, "INVALID_MARKET");

        Market storage m = markets[id];
        require(m.resolved, "NOT_RESOLVED");
        require(!m.totalsReady, "ALREADY_SUBMITTED");

        bytes32[] memory handlesList = new bytes32[](2);
        handlesList[0] = euint64.unwrap(m.totalYes);
        handlesList[1] = euint64.unwrap(m.totalNo);

        FHE.checkSignatures(handlesList, abiEncodedCleartexts, decryptionProof);

        (uint256 rawTotalYes, uint256 rawTotalNo) = abi.decode(abiEncodedCleartexts, (uint256, uint256));
        uint64 decryptedTotalYes = uint64(rawTotalYes);
        uint64 decryptedTotalNo = uint64(rawTotalNo);

        uint64 totalPool = decryptedTotalYes + decryptedTotalNo;
        uint64 winningPool = m.outcome ? decryptedTotalYes : decryptedTotalNo;

        require(winningPool > 0, "NO_WINNERS");

        uint64 fee = (totalPool * uint64(feeBps)) / 10000;

        m.totalPoolPlain = totalPool - fee;
        m.winningPoolPlain = winningPool;
        m.totalsReady = true;

        emit TotalsDecrypted(id, m.totalPoolPlain, m.winningPoolPlain);
    }

    // =========================
    // PREPARE CLAIM ETH
    // =========================
    // For ETH markets the bet side is encrypted. Before claiming the user must
    // "prepare" which computes their win boolean and marks it as publicly
    // decryptable. Then the frontend calls the relayer to decrypt it.

    function prepareClaimETH(uint256 id) external {
        require(id < marketCount, "INVALID_MARKET");

        Market storage m = markets[id];
        require(m.totalsReady, "NOT_READY");

        Bet storage b = bets[id][msg.sender];
        require(b.hasBet, "NO_BET");
        require(!b.claimed, "CLAIMED");
        require(!b.prepared, "ALREADY_PREPARED");

        ebool win = FHE.eq(b.side, FHE.asEbool(m.outcome));
        b.winResult = win;
        b.prepared = true;

        FHE.allowThis(win);
        FHE.makePubliclyDecryptable(win);

        bytes32 winHandle = ebool.unwrap(win);
        emit ClaimPrepared(id, msg.sender, winHandle);
    }

    // =========================
    // VIEW: get bytes32 handle for a user's win boolean
    // =========================

    function getWinHandle(uint256 id, address user) external view returns (bytes32) {
        return ebool.unwrap(bets[id][user].winResult);
    }

    // =========================
    // CLAIM ETH
    // =========================
    // After prepareClaimETH + off-chain decryption, the user submits the
    // raw ABI-encoded cleartext (bool) and the proof.

    function claimETH(
        uint256 id,
        bytes calldata abiEncodedCleartexts,
        bytes calldata decryptionProof
    ) external nonReentrant {
        require(id < marketCount, "INVALID_MARKET");

        Market storage m = markets[id];
        require(m.totalsReady, "NOT_READY");

        Bet storage b = bets[id][msg.sender];
        require(b.hasBet, "NO_BET");
        require(!b.claimed, "CLAIMED");
        require(b.prepared, "NOT_PREPARED");

        bytes32[] memory handlesList = new bytes32[](1);
        handlesList[0] = ebool.unwrap(b.winResult);

        FHE.checkSignatures(handlesList, abiEncodedCleartexts, decryptionProof);

        bool won = abi.decode(abiEncodedCleartexts, (bool));

        b.claimed = true;

        if (won) {
            uint256 payout = (b.ethAmount * m.totalPoolPlain) / m.winningPoolPlain;
            (bool ok, ) = msg.sender.call{value: payout}("");
            require(ok, "ETH_FAIL");
        }

        emit Claimed(id, msg.sender);
    }

    // =========================
    // CLAIM TOKEN
    // =========================
    // For token markets: payout is computed in encrypted form and returned to the user.

    function claimToken(uint256 id) external {
        require(id < marketCount, "INVALID_MARKET");

        Market storage m = markets[id];
        require(m.totalsReady, "NOT_READY");

        Bet storage b = bets[id][msg.sender];
        require(b.hasBet, "NO_BET");
        require(!b.claimed, "CLAIMED");

        b.claimed = true;

        ebool win = FHE.eq(b.side, FHE.asEbool(m.outcome));

        uint64 multiplier = m.totalPoolPlain / m.winningPoolPlain;

        euint64 payout = FHE.select(
            win,
            FHE.mul(b.amount, FHE.asEuint64(multiplier)),
            FHE.asEuint64(0)
        );

        FHE.allowTransient(payout, m.token);
        IConfidentialERC20(m.token).confidentialTransfer(msg.sender, payout);

        emit Claimed(id, msg.sender);
    }

    // =========================
    // OWNER: WITHDRAW FEES
    // =========================

    function withdrawFees() external onlyOwner {
        (bool ok, ) = owner.call{value: address(this).balance}("");
        require(ok, "WITHDRAW_FAIL");
    }
}
