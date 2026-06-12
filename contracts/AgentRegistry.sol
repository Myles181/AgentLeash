// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @notice Identity and reputation registry for AI agents on Pharos.
///         Each agent gets a unique `prefix.leash` username (e.g. alvin.leash).
///         Reputation starts at 0 and grows through verified payments and tasks.
contract AgentRegistry {

    // Fix 10: enum instead of string in events — saves ~2,800 gas per emission
    enum ReputationReason { Payment, Task, Failure }

    // Fix 5+6+7: lean storage struct — no wallet (= mapping key), no username (= _addressToUsername)
    // Slot 1: reputationScore + successfulPayments + successfulTasks + failedTasks (4 × uint64 = 256 bits)
    // Slot 2: registeredAt (uint64)
    // Was 7 slots, now 2 slots — saves ~100,000 gas on registration
    struct Agent {
        uint64 reputationScore;
        uint64 successfulPayments;
        uint64 successfulTasks;
        uint64 failedTasks;
        uint64 registeredAt;
    }

    // View struct for external callers — wallet and username reconstructed at read time, never stored
    struct AgentView {
        address wallet;
        string  username;
        uint64  reputationScore;
        uint64  successfulPayments;
        uint64  successfulTasks;
        uint64  failedTasks;
        uint64  registeredAt;
    }

    // Fix 8: bytes32 key = keccak256(username) — compute hash once, reuse across lookups
    mapping(bytes32 => address) private _usernameToAddress;
    // address → full username string kept here only — single source of truth
    mapping(address => string)  private _addressToUsername;
    mapping(address => Agent)   private _agents;
    address[] private _registered;
    mapping(address => bool) public authorized;

    address public owner;

    // Fix 6: constants match uint64 field type
    uint64 public constant PAYMENT_SCORE = 1;
    uint64 public constant TASK_SCORE    = 3;
    uint64 public constant FAIL_PENALTY  = 2;

    event AgentRegistered(address indexed wallet, string username);
    // Fix 10: ReputationReason enum replaces string
    event ReputationUpdated(address indexed agent, uint64 newScore, ReputationReason reason);
    event AuthorizationChanged(address indexed caller, bool status);
    // Fix 4: ownership transfer event
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    modifier onlyAuthorized() {
        require(authorized[msg.sender] || msg.sender == owner, "Not authorized");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    // --- Admin ---

    function setAuthorized(address caller, bool status) external onlyOwner {
        authorized[caller] = status;
        emit AuthorizationChanged(caller, status);
    }

    // Fix 4: ownership can now be transferred, previous owner logged for auditability
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "New owner is zero address");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    // --- Registration ---

    function register(string calldata prefix) external {
        // Fix 8: cache length — bytes(prefix).length was evaluated twice before
        uint256 len = bytes(prefix).length;
        require(len >= 1 && len <= 32, "Prefix must be 1-32 chars");
        require(bytes(_addressToUsername[msg.sender]).length == 0, "Already registered");
        require(_validatePrefix(prefix), "Prefix: lowercase letters, numbers, underscores only");

        string memory username = _buildUsername(prefix);
        // Fix 8: single hash computation reused for both the existence check and the write
        bytes32 key = _usernameKey(username);
        require(_usernameToAddress[key] == address(0), "Username already taken");

        _usernameToAddress[key] = msg.sender;
        _addressToUsername[msg.sender] = username;
        // Fix 5+6+7: no wallet, no username in struct — lean write across 2 slots
        _agents[msg.sender] = Agent({
            reputationScore:    0,
            successfulPayments: 0,
            successfulTasks:    0,
            failedTasks:        0,
            registeredAt:       uint64(block.timestamp)
        });
        _registered.push(msg.sender);

        emit AgentRegistered(msg.sender, username);
    }

    // --- Resolution ---

    function resolve(string calldata input) external view returns (address) {
        bytes32 key = _usernameKey(_normalizeUsername(input));
        address addr = _usernameToAddress[key];
        require(addr != address(0), string(abi.encodePacked("No agent registered as ", input)));
        return addr;
    }

    function reverseResolve(address wallet) external view returns (string memory) {
        string memory username = _addressToUsername[wallet];
        require(bytes(username).length > 0, "Address not registered");
        return username;
    }

    // --- Profile reads ---

    // Fix 3: was `this.resolve(input)` — external self-call replaced with direct internal lookup
    function getProfile(string calldata input) external view returns (AgentView memory) {
        bytes32 key = _usernameKey(_normalizeUsername(input));
        address addr = _usernameToAddress[key];
        require(addr != address(0), string(abi.encodePacked("No agent registered as ", input)));
        return _buildView(addr);
    }

    function getProfileByAddress(address wallet) external view returns (AgentView memory) {
        return _buildView(wallet);
    }

    function isRegistered(address wallet) external view returns (bool) {
        return bytes(_addressToUsername[wallet]).length > 0;
    }

    // --- Reputation writes (authorized callers only) ---

    function recordPaymentSuccess(address agent) external onlyAuthorized {
        Agent storage a = _agents[agent];
        // Fix 5: registeredAt != 0 replaces wallet != address(0) since wallet removed from struct
        require(a.registeredAt != 0, "Agent not registered");
        a.reputationScore += PAYMENT_SCORE;
        a.successfulPayments++;
        emit ReputationUpdated(agent, a.reputationScore, ReputationReason.Payment);
    }

    function recordTaskSuccess(address agent) external onlyAuthorized {
        Agent storage a = _agents[agent];
        require(a.registeredAt != 0, "Agent not registered");
        a.reputationScore += TASK_SCORE;
        a.successfulTasks++;
        emit ReputationUpdated(agent, a.reputationScore, ReputationReason.Task);
    }

    function recordFailure(address agent) external onlyAuthorized {
        Agent storage a = _agents[agent];
        require(a.registeredAt != 0, "Agent not registered");
        a.reputationScore = a.reputationScore >= FAIL_PENALTY
            ? a.reputationScore - FAIL_PENALTY
            : 0;
        a.failedTasks++;
        emit ReputationUpdated(agent, a.reputationScore, ReputationReason.Failure);
    }

    // --- Leaderboard ---

    function getTopAgents(uint256 limit) external view returns (AgentView[] memory) {
        uint256 total = _registered.length;
        if (limit > total) limit = total;

        AgentView[] memory all = new AgentView[](total);
        for (uint256 i = 0; i < total; i++) {
            all[i] = _buildView(_registered[i]);
        }

        for (uint256 i = 0; i < total; i++) {
            for (uint256 j = 0; j < total - i - 1; j++) {
                if (all[j].reputationScore < all[j + 1].reputationScore) {
                    AgentView memory tmp = all[j];
                    all[j] = all[j + 1];
                    all[j + 1] = tmp;
                }
            }
        }

        AgentView[] memory top = new AgentView[](limit);
        for (uint256 i = 0; i < limit; i++) {
            top[i] = all[i];
        }
        return top;
    }

    function totalAgents() external view returns (uint256) {
        return _registered.length;
    }

    // --- Internal helpers ---

    // Fix 5+7: builds the full view struct at read time — wallet and username reconstructed, never stored twice
    function _buildView(address wallet) internal view returns (AgentView memory) {
        Agent storage a = _agents[wallet];
        return AgentView({
            wallet:             wallet,
            username:           _addressToUsername[wallet],
            reputationScore:    a.reputationScore,
            successfulPayments: a.successfulPayments,
            successfulTasks:    a.successfulTasks,
            failedTasks:        a.failedTasks,
            registeredAt:       a.registeredAt
        });
    }

    // Fix 8: centralised hash computation so callers never hash the string more than once per function
    function _usernameKey(string memory username) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(username));
    }

    function _buildUsername(string memory prefix) internal pure returns (string memory) {
        return string(abi.encodePacked(prefix, ".leash"));
    }

    function _normalizeUsername(string memory input) internal pure returns (string memory) {
        bytes memory b = bytes(input);
        if (b.length > 6) {
            bytes memory suffix = bytes(".leash");
            bool hasSuffix = true;
            for (uint256 i = 0; i < 6; i++) {
                if (b[b.length - 6 + i] != suffix[i]) {
                    hasSuffix = false;
                    break;
                }
            }
            if (hasSuffix) return input;
        }
        return _buildUsername(input);
    }

    function _validatePrefix(string memory prefix) internal pure returns (bool) {
        bytes memory b = bytes(prefix);
        for (uint256 i = 0; i < b.length; i++) {
            bytes1 c = b[i];
            bool isLower      = c >= 0x61 && c <= 0x7a;
            bool isDigit      = c >= 0x30 && c <= 0x39;
            bool isUnderscore = c == 0x5f;
            if (!isLower && !isDigit && !isUnderscore) return false;
        }
        return true;
    }

    // Dev tooling only — lets the deployer wipe a wallet's registration for clean test reruns
    function resetRegistration(address wallet) external onlyOwner {
        string memory username = _addressToUsername[wallet];
        require(bytes(username).length > 0, "Not registered");

        bytes32 key = _usernameKey(username);
        delete _usernameToAddress[key];
        delete _addressToUsername[wallet];
        delete _agents[wallet];

        // Remove from _registered array
        for (uint256 i = 0; i < _registered.length; i++) {
            if (_registered[i] == wallet) {
                _registered[i] = _registered[_registered.length - 1];
                _registered.pop();
                break;
            }
        }
    }
}
