// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./AgentRegistry.sol";

contract LeashGatedTransfer {
    AgentRegistry public immutable registry;

    // Fix 1: owner + authorized mapping — same pattern as AgentRegistry
    address public owner;
    mapping(address => bool) public authorized;

    // Fix 2: simple nonReentrant mutex — belt-and-suspenders on top of CEI fix
    uint256 private _locked = 1;

    event LeashTransfer(
        string fromUsername,
        string toUsername,
        uint256 amount,
        uint64 recipientScoreAtTime,
        uint256 timestamp
    );

    event TaskRecorded(
        address indexed agent,
        string username,
        bool success,
        uint64 newScore
    );

    // Fix 1
    event AuthorizationChanged(address indexed caller, bool status);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    // Fix 1: recordTask now requires authorization
    modifier onlyAuthorized() {
        require(authorized[msg.sender] || msg.sender == owner, "Not authorized");
        _;
    }

    // Fix 2: nonReentrant mutex
    modifier nonReentrant() {
        require(_locked == 1, "Reentrant call");
        _locked = 2;
        _;
        _locked = 1;
    }

    constructor(address registryAddress) {
        registry = AgentRegistry(registryAddress);
        owner = msg.sender;
    }

    // Fix 1: admin functions mirror AgentRegistry pattern
    function setAuthorized(address caller, bool status) external onlyOwner {
        authorized[caller] = status;
        emit AuthorizationChanged(caller, status);
    }

    // Fix 4: ownership transfer
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "New owner is zero address");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    /// @notice Transfer native PHRS to a .leash agent, gated by minimum reputation score.
    function leashedTransfer(
        string calldata recipientUsername,
        uint256 minRepScore
    ) external payable nonReentrant {
        require(msg.value > 0, "Amount must be greater than 0");

        address recipient = registry.resolve(recipientUsername);
        AgentRegistry.AgentView memory recipientAgent = registry.getProfileByAddress(recipient);

        require(
            recipientAgent.reputationScore >= minRepScore,
            _gateRevertReason(recipientAgent.username, recipientAgent.reputationScore, minRepScore)
        );

        string memory fromUsername = "";
        try registry.reverseResolve(msg.sender) returns (string memory u) {
            fromUsername = u;
        } catch {}

        // Fix 2: CEI — state update BEFORE ETH transfer
        // recordPaymentSuccess increments score and payment count before any value moves
        registry.recordPaymentSuccess(recipient);

        // Fix 2: interaction last — reentrancy is now harmless since state already updated
        (bool sent,) = payable(recipient).call{value: msg.value}("");
        require(sent, "Transfer failed");

        emit LeashTransfer(
            fromUsername,
            recipientAgent.username,
            msg.value,
            recipientAgent.reputationScore,
            block.timestamp
        );
    }

    /// @notice Record a completed or failed task for a registered agent.
    // Fix 1: onlyAuthorized — no longer callable by arbitrary addresses
    function recordTask(string calldata agentUsername, bool success) external onlyAuthorized {
        address agentAddr = registry.resolve(agentUsername);
        // Fix 9: single cross-contract read — username fetched once for the event
        AgentRegistry.AgentView memory agent = registry.getProfileByAddress(agentAddr);

        if (success) {
            registry.recordTaskSuccess(agentAddr);
        } else {
            registry.recordFailure(agentAddr);
        }

        // Fix 9: compute new score locally — no second getProfileByAddress call needed
        uint64 newScore;
        if (success) {
            newScore = agent.reputationScore + registry.TASK_SCORE();
        } else {
            uint64 penalty = registry.FAIL_PENALTY();
            newScore = agent.reputationScore >= penalty
                ? agent.reputationScore - penalty
                : 0;
        }

        emit TaskRecorded(agentAddr, agent.username, success, newScore);
    }

    // --- Internal ---

    function _gateRevertReason(
        string memory username,
        uint64 actual,
        uint256 required
    ) internal pure returns (string memory) {
        return string(abi.encodePacked(
            username,
            " has reputation score ",
            _uint2str(actual),
            " - minimum required is ",
            _uint2str(required)
        ));
    }

    function _uint2str(uint256 value) internal pure returns (string memory) {
        if (value == 0) return "0";
        uint256 tmp = value;
        uint256 digits;
        while (tmp != 0) { digits++; tmp /= 10; }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits--;
            buffer[digits] = bytes1(uint8(48 + (value % 10)));
            value /= 10;
        }
        return string(buffer);
    }
}
