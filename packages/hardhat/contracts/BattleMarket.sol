// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {FHE, euint64, ebool, externalEuint64, externalEbool} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

interface AggregatorV3Interface {
    function latestRoundData()
        external
        view
        returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound);
}

interface IConfidentialERC20 {
    function confidentialTransfer(address to, euint64 amount) external returns (euint64);
    function confidentialTransferFrom(address from, address to, euint64 amount) external returns (euint64);
    function isOperator(address holder, address spender) external view returns (bool);
}

/**
 * @title  ConfidentialBattleMarket
 * @notice Pari-mutuel prediction markets scoped to Groups (N members) or 1v1 Battles (2 members).
 *         Bet sides + cUSDC amounts are encrypted via FHE; ETH amounts are public.
 *         Markets are either Chainlink price markets (auto-resolved) or manual markets
 *         (resolved by the battle creator / group admin).
 *
 *         Architecture:
 *           - Group  : N members, three join modes (admin-invite, link, public).
 *           - Battle : either {scope=ONE_V_ONE, members={creator,opponent}} (opponent must accept)
 *                      or {scope=GROUP, groupId=...} (any member of the group can bet).
 *           - Market : created inside a battle. Same FHE pari-mutuel mechanic as
 *                      ConfidentialPredictionMarket, just access-gated to battle members.
 */
contract ConfidentialBattleMarket is ZamaEthereumConfig {
    // =========================
    // STORAGE / TYPES
    // =========================

    address public owner;
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

    enum AssetType {
        ETH,
        CONFIDENTIAL
    }
    enum MarketKind {
        BTC_PRICE,
        ETH_PRICE,
        MANUAL
    }
    enum BattleScope {
        ONE_V_ONE,
        GROUP
    }
    enum BattleStatus {
        PENDING, // 1v1: invite sent, waiting for opponent
        ACTIVE,
        CANCELLED
    }
    enum JoinMode {
        ADMIN_INVITE, // admin must add each member
        INVITE_LINK, // anyone with secret hash can join
        PUBLIC // anyone can join
    }

    struct Group {
        address admin;
        string name;
        JoinMode joinMode;
        bytes32 inviteHash; // keccak256(secret) for INVITE_LINK; 0 otherwise
        bool exists;
    }

    struct Battle {
        BattleScope scope;
        BattleStatus status;
        address creator;
        address opponent; // for 1v1 only; address(0) until accepted
        uint256 groupId; // for GROUP scope
        bool exists;
    }

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
        uint256 battleId;
        AssetType assetType;
        MarketKind kind;
        address token; // cUSDC address for CONFIDENTIAL
        address creator; // who created the market
        // Price-market fields (used when kind != MANUAL):
        uint256 strikePrice;
        // Manual-market fields:
        string question;
        // Common:
        uint256 resolveTime;
        bool resolved;
        bool outcome;
        // Encrypted aggregates:
        euint64 totalYes;
        euint64 totalNo;
        // Decrypted post-settlement:
        uint64 totalPoolPlain;
        uint64 winningPoolPlain;
        bool totalsReady;
    }

    uint256 public groupCount;
    uint256 public battleCount;
    uint256 public marketCount;

    mapping(uint256 => Group) public groups;
    // group => member => bool
    mapping(uint256 => mapping(address => bool)) public groupMembers;
    // group => members[] (small N, kept for off-chain enumeration)
    mapping(uint256 => address[]) private _groupMemberList;

    mapping(uint256 => Battle) public battles;

    mapping(uint256 => Market) public markets;
    // marketId => user => Bet
    mapping(uint256 => mapping(address => Bet)) public bets;

    AggregatorV3Interface public btcFeed;
    AggregatorV3Interface public ethFeed;

    // =========================
    // EVENTS
    // =========================

    event GroupCreated(uint256 indexed id, address indexed admin, JoinMode joinMode, string name);
    event GroupMemberAdded(uint256 indexed id, address indexed member);
    event GroupJoinModeChanged(uint256 indexed id, JoinMode newMode);

    event BattleCreated(uint256 indexed id, BattleScope scope, address indexed creator, uint256 groupId);
    event BattleAccepted(uint256 indexed id, address indexed opponent);
    event BattleCancelled(uint256 indexed id);

    event MarketCreated(
        uint256 indexed id,
        uint256 indexed battleId,
        MarketKind kind,
        AssetType assetType,
        uint256 strikePrice,
        uint256 resolveTime
    );
    event BetPlaced(uint256 indexed marketId, address indexed user, AssetType assetType);
    event MarketResolved(uint256 indexed id, bool outcome);
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
    // GROUPS
    // =========================

    /**
     * @notice Create a group. `inviteHash` is keccak256(off-chain-secret) when
     *         joinMode == INVITE_LINK; pass bytes32(0) otherwise.
     */
    function createGroup(string calldata name, JoinMode joinMode, bytes32 inviteHash) external returns (uint256 id) {
        if (joinMode == JoinMode.INVITE_LINK) {
            require(inviteHash != bytes32(0), "INVITE_HASH_REQUIRED");
        } else {
            require(inviteHash == bytes32(0), "UNEXPECTED_HASH");
        }

        id = groupCount++;
        Group storage g = groups[id];
        g.admin = msg.sender;
        g.name = name;
        g.joinMode = joinMode;
        g.inviteHash = inviteHash;
        g.exists = true;

        groupMembers[id][msg.sender] = true;
        _groupMemberList[id].push(msg.sender);

        emit GroupCreated(id, msg.sender, joinMode, name);
        emit GroupMemberAdded(id, msg.sender);
    }

    /// @notice Admin adds a member directly (any joinMode).
    function addGroupMember(uint256 id, address member) external {
        Group storage g = groups[id];
        require(g.exists, "NO_GROUP");
        require(msg.sender == g.admin, "NOT_ADMIN");
        require(!groupMembers[id][member], "ALREADY_MEMBER");
        groupMembers[id][member] = true;
        _groupMemberList[id].push(member);
        emit GroupMemberAdded(id, member);
    }

    /// @notice Self-join with a secret matching `inviteHash`. Only for INVITE_LINK groups.
    function joinGroupWithSecret(uint256 id, bytes calldata secret) external {
        Group storage g = groups[id];
        require(g.exists, "NO_GROUP");
        require(g.joinMode == JoinMode.INVITE_LINK, "NOT_INVITE_LINK");
        require(keccak256(secret) == g.inviteHash, "BAD_SECRET");
        require(!groupMembers[id][msg.sender], "ALREADY_MEMBER");
        groupMembers[id][msg.sender] = true;
        _groupMemberList[id].push(msg.sender);
        emit GroupMemberAdded(id, msg.sender);
    }

    /// @notice Self-join an open group. Only for PUBLIC groups.
    function joinGroupPublic(uint256 id) external {
        Group storage g = groups[id];
        require(g.exists, "NO_GROUP");
        require(g.joinMode == JoinMode.PUBLIC, "NOT_PUBLIC");
        require(!groupMembers[id][msg.sender], "ALREADY_MEMBER");
        groupMembers[id][msg.sender] = true;
        _groupMemberList[id].push(msg.sender);
        emit GroupMemberAdded(id, msg.sender);
    }

    function getGroupMembers(uint256 id) external view returns (address[] memory) {
        return _groupMemberList[id];
    }

    function groupMemberCount(uint256 id) external view returns (uint256) {
        return _groupMemberList[id].length;
    }

    function setGroupJoinMode(uint256 id, JoinMode newMode, bytes32 newInviteHash) external {
        Group storage g = groups[id];
        require(g.exists, "NO_GROUP");
        require(msg.sender == g.admin, "NOT_ADMIN");
        if (newMode == JoinMode.INVITE_LINK) {
            require(newInviteHash != bytes32(0), "INVITE_HASH_REQUIRED");
        } else {
            require(newInviteHash == bytes32(0), "UNEXPECTED_HASH");
        }
        g.joinMode = newMode;
        g.inviteHash = newInviteHash;
        emit GroupJoinModeChanged(id, newMode);
    }

    // =========================
    // BATTLES
    // =========================

    /// @notice Create a 1v1 battle invite. Opponent must call `acceptBattle` to activate it.
    function createOneVOneBattle(address opponent) external returns (uint256 id) {
        require(opponent != address(0) && opponent != msg.sender, "BAD_OPPONENT");
        id = battleCount++;
        Battle storage b = battles[id];
        b.scope = BattleScope.ONE_V_ONE;
        b.status = BattleStatus.PENDING;
        b.creator = msg.sender;
        b.opponent = opponent;
        b.exists = true;
        emit BattleCreated(id, BattleScope.ONE_V_ONE, msg.sender, 0);
    }

    function acceptBattle(uint256 id) external {
        Battle storage b = battles[id];
        require(b.exists, "NO_BATTLE");
        require(b.scope == BattleScope.ONE_V_ONE, "NOT_1V1");
        require(b.status == BattleStatus.PENDING, "BAD_STATUS");
        require(msg.sender == b.opponent, "NOT_INVITED");
        b.status = BattleStatus.ACTIVE;
        emit BattleAccepted(id, msg.sender);
    }

    /// @notice Cancel a 1v1 battle that hasn't been accepted yet, or any battle that has no markets.
    function cancelBattle(uint256 id) external {
        Battle storage b = battles[id];
        require(b.exists, "NO_BATTLE");
        require(msg.sender == b.creator, "NOT_CREATOR");
        require(b.status == BattleStatus.PENDING, "NOT_PENDING");
        b.status = BattleStatus.CANCELLED;
        emit BattleCancelled(id);
    }

    /// @notice Create a battle scoped to an existing group. Caller must be a member.
    function createGroupBattle(uint256 groupId) external returns (uint256 id) {
        Group storage g = groups[groupId];
        require(g.exists, "NO_GROUP");
        require(groupMembers[groupId][msg.sender], "NOT_MEMBER");
        id = battleCount++;
        Battle storage b = battles[id];
        b.scope = BattleScope.GROUP;
        b.status = BattleStatus.ACTIVE;
        b.creator = msg.sender;
        b.groupId = groupId;
        b.exists = true;
        emit BattleCreated(id, BattleScope.GROUP, msg.sender, groupId);
    }

    /// @dev Returns true iff `who` is allowed to bet inside `battleId`.
    function _isBattleParticipant(uint256 battleId, address who) internal view returns (bool) {
        Battle storage b = battles[battleId];
        if (!b.exists || b.status != BattleStatus.ACTIVE) return false;
        if (b.scope == BattleScope.ONE_V_ONE) {
            return who == b.creator || who == b.opponent;
        }
        return groupMembers[b.groupId][who];
    }

    /// @dev Returns true iff `who` is allowed to create / resolve markets inside `battleId`.
    ///      For 1v1: either participant. For groups: only the group admin.
    function _canManageMarkets(uint256 battleId, address who) internal view returns (bool) {
        Battle storage b = battles[battleId];
        if (!b.exists || b.status != BattleStatus.ACTIVE) return false;
        if (b.scope == BattleScope.ONE_V_ONE) {
            return who == b.creator || who == b.opponent;
        }
        return who == groups[b.groupId].admin;
    }

    // =========================
    // CREATE MARKET (ETH)
    // =========================

    function createMarketETH(
        uint256 battleId,
        MarketKind kind,
        uint256 strikePrice, // ignored when kind == MANUAL
        string calldata question, // ignored when kind != MANUAL
        uint256 resolveTime,
        uint256 seedYes,
        uint256 seedNo
    ) external payable returns (uint256 id) {
        require(_canManageMarkets(battleId, msg.sender), "NOT_ALLOWED");
        require(resolveTime > block.timestamp, "RESOLVE_IN_PAST");
        require(msg.value == seedYes + seedNo, "INVALID_ETH");
        require(seedYes > 0 && seedNo > 0, "ZERO_SEED");

        id = marketCount++;
        Market storage m = markets[id];
        m.battleId = battleId;
        m.assetType = AssetType.ETH;
        m.kind = kind;
        m.creator = msg.sender;
        m.strikePrice = strikePrice;
        m.question = question;
        m.resolveTime = resolveTime;

        m.totalYes = FHE.asEuint64(uint64(seedYes));
        m.totalNo = FHE.asEuint64(uint64(seedNo));

        FHE.allowThis(m.totalYes);
        FHE.allowThis(m.totalNo);

        emit MarketCreated(id, battleId, kind, AssetType.ETH, strikePrice, resolveTime);
    }

    // =========================
    // CREATE MARKET (TOKEN / cUSDC)
    // =========================

    function createMarketToken(
        uint256 battleId,
        MarketKind kind,
        address token,
        uint256 strikePrice,
        string calldata question,
        uint256 resolveTime,
        externalEuint64 seedYes,
        externalEuint64 seedNo,
        bytes calldata proof
    ) external returns (uint256 id) {
        require(_canManageMarkets(battleId, msg.sender), "NOT_ALLOWED");
        require(resolveTime > block.timestamp, "RESOLVE_IN_PAST");
        require(token != address(0), "ZERO_TOKEN");

        id = marketCount++;
        Market storage m = markets[id];
        m.battleId = battleId;
        m.assetType = AssetType.CONFIDENTIAL;
        m.kind = kind;
        m.token = token;
        m.creator = msg.sender;
        m.strikePrice = strikePrice;
        m.question = question;
        m.resolveTime = resolveTime;

        euint64 yesAmount = FHE.fromExternal(seedYes, proof);
        euint64 noAmount = FHE.fromExternal(seedNo, proof);

        FHE.allowTransient(yesAmount, token);
        FHE.allowTransient(noAmount, token);
        IConfidentialERC20(token).confidentialTransferFrom(msg.sender, address(this), yesAmount);
        IConfidentialERC20(token).confidentialTransferFrom(msg.sender, address(this), noAmount);

        m.totalYes = yesAmount;
        m.totalNo = noAmount;
        FHE.allowThis(m.totalYes);
        FHE.allowThis(m.totalNo);

        emit MarketCreated(id, battleId, kind, AssetType.CONFIDENTIAL, strikePrice, resolveTime);
    }

    // =========================
    // PLACE BET (ETH)
    // =========================

    function placeBetETH(uint256 id, externalEbool side, bytes calldata proof) external payable {
        require(id < marketCount, "INVALID_MARKET");
        require(msg.value > 0, "ZERO_BET");

        Market storage m = markets[id];
        require(m.assetType == AssetType.ETH, "NOT_ETH");
        require(!m.resolved, "ALREADY_RESOLVED");
        require(block.timestamp < m.resolveTime, "MARKET_CLOSED");
        require(_isBattleParticipant(m.battleId, msg.sender), "NOT_PARTICIPANT");

        ebool s = FHE.fromExternal(side, proof);
        euint64 encAmt = FHE.asEuint64(uint64(msg.value));

        Bet storage b = bets[id][msg.sender];
        require(!b.hasBet, "ALREADY_BET");

        b.hasBet = true;
        b.ethAmount = msg.value;
        b.amount = encAmt;
        b.side = s;

        m.totalYes = FHE.select(s, FHE.add(m.totalYes, encAmt), m.totalYes);
        m.totalNo = FHE.select(s, m.totalNo, FHE.add(m.totalNo, encAmt));

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
        require(_isBattleParticipant(m.battleId, msg.sender), "NOT_PARTICIPANT");

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
        m.totalNo = FHE.select(s, m.totalNo, FHE.add(m.totalNo, amt));

        FHE.allowThis(m.totalYes);
        FHE.allowThis(m.totalNo);
        FHE.allowThis(b.amount);
        FHE.allowThis(b.side);
        FHE.allow(b.amount, msg.sender);
        FHE.allow(b.side, msg.sender);

        emit BetPlaced(id, msg.sender, AssetType.CONFIDENTIAL);
    }

    // =========================
    // RESOLVE MARKET (PRICE)
    // =========================

    /// @notice Auto-resolve a price market via Chainlink. Anyone can call after resolveTime.
    function resolvePriceMarket(uint256 id) external {
        require(id < marketCount, "INVALID_MARKET");
        Market storage m = markets[id];
        require(m.kind != MarketKind.MANUAL, "NOT_PRICE");
        require(block.timestamp >= m.resolveTime, "EARLY");
        require(!m.resolved, "DONE");

        (, int256 price, , , ) = m.kind == MarketKind.BTC_PRICE
            ? btcFeed.latestRoundData()
            : ethFeed.latestRoundData();
        require(price > 0, "INVALID_PRICE");

        m.outcome = uint256(price) > m.strikePrice;
        _finalizeResolve(m);
        emit MarketResolved(id, m.outcome);
    }

    // =========================
    // RESOLVE MARKET (MANUAL)
    // =========================

    /// @notice Resolve a manual market. Caller must be allowed to manage markets in the battle
    ///         (1v1: either participant; group: group admin).
    function resolveManualMarket(uint256 id, bool outcome) external {
        require(id < marketCount, "INVALID_MARKET");
        Market storage m = markets[id];
        require(m.kind == MarketKind.MANUAL, "NOT_MANUAL");
        require(block.timestamp >= m.resolveTime, "EARLY");
        require(!m.resolved, "DONE");
        require(_canManageMarkets(m.battleId, msg.sender), "NOT_ALLOWED");

        m.outcome = outcome;
        _finalizeResolve(m);
        emit MarketResolved(id, m.outcome);
    }

    function _finalizeResolve(Market storage m) internal {
        m.resolved = true;
        FHE.allow(m.totalYes, msg.sender);
        FHE.allow(m.totalNo, msg.sender);
        FHE.makePubliclyDecryptable(m.totalYes);
        FHE.makePubliclyDecryptable(m.totalNo);
    }

    // =========================
    // VIEW HANDLES
    // =========================

    function getTotalHandles(uint256 id) external view returns (bytes32 yesHandle, bytes32 noHandle) {
        Market storage m = markets[id];
        yesHandle = euint64.unwrap(m.totalYes);
        noHandle = euint64.unwrap(m.totalNo);
    }

    function getWinHandle(uint256 id, address user) external view returns (bytes32) {
        return ebool.unwrap(bets[id][user].winResult);
    }

    // =========================
    // SUBMIT TOTALS (after KMS public-decrypt)
    // =========================

    function submitTotals(uint256 id, bytes calldata abiEncodedCleartexts, bytes calldata decryptionProof) external {
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
    // PREPARE / CLAIM (ETH)
    // =========================

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

        emit ClaimPrepared(id, msg.sender, ebool.unwrap(win));
    }

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
    // CLAIM (TOKEN)
    // =========================

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

        euint64 payout = FHE.select(win, FHE.mul(b.amount, FHE.asEuint64(multiplier)), FHE.asEuint64(0));

        FHE.allowTransient(payout, m.token);
        IConfidentialERC20(m.token).confidentialTransfer(msg.sender, payout);

        emit Claimed(id, msg.sender);
    }

    // =========================
    // OWNER
    // =========================

    function withdrawFees() external onlyOwner {
        (bool ok, ) = owner.call{value: address(this).balance}("");
        require(ok, "WITHDRAW_FAIL");
    }

    function setFeeBps(uint256 newFeeBps) external onlyOwner {
        require(newFeeBps <= 1000, "FEE_TOO_HIGH"); // cap 10%
        feeBps = newFeeBps;
    }
}
