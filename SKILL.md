---
name: agentleash
description: >
  Trust-gated payment and identity skill for Pharos.
  Registers AI agents with human-readable .leash usernames,
  tracks on-chain reputation through payments and tasks,
  and gates transfers to agents that meet a minimum trust score.
  Use this skill when: sending PROS to another agent, checking if an agent is trustworthy,
  registering a new agent identity, recording task outcomes, or viewing the reputation leaderboard.
version: 1.0.0
requires:
  - node
  - cast
---

## Capability Index

| What you want to do                        | Tool                  | Details                                |
|--------------------------------------------|-----------------------|----------------------------------------|
| Register an agent with a .leash username   | `register_agent`      | See [Registration](#registration)      |
| Look up an agent's wallet address          | `resolve_agent`       | See [Resolution](#resolution)          |
| Check reputation score and stats           | `check_reputation`    | See [Reputation](#reputation)          |
| Send PROS with a reputation gate           | `leashed_transfer`    | See [Transfers](#transfers)            |
| Record task success or failure             | `record_task`         | See [Tasks](#tasks)                    |
| View top agents ranked by score            | `get_leaderboard`     | See [Leaderboard](#leaderboard)        |

---

## Pre-execution Checks

Before any operation, the skill validates:

1. `PRIVATE_KEY` env var is set and has `0x` prefix
2. `REGISTRY_ADDRESS` and `TRANSFER_ADDRESS` env vars are set (populated after deploy)
3. Wallet has sufficient PROS for gas (for write operations)
4. For `leashed_transfer`: wallet balance ≥ transfer amount + gas

---

## Registration

Registers a new agent identity on Pharos. One registration per wallet.

```
Input:  prefix (string) — lowercase letters, numbers, underscores. Max 32 chars.
Output: username (e.g. "alvin.leash"), txHash, blockNumber
```

**Username rules enforced on-chain:**
- Must be unique across all registered agents
- Lowercase alphanumeric + underscore only
- `.leash` suffix is appended automatically and cannot be omitted or changed

---

## Resolution

Bidirectional lookup between username and wallet address.

```
resolve("alvin")       → 0xabc...   (auto-appends .leash)
resolve("alvin.leash") → 0xabc...   (same result)
reverseResolve(0xabc...) → "alvin.leash"
```

---

## Reputation

Scores update on-chain with every payment and task outcome:

| Event                    | Score delta |
|--------------------------|-------------|
| Successful payment received | +1       |
| Successful task completed   | +3       |
| Failed task                 | −2       |

Score floor is 0 — it can never go negative.

**Tiers:**
| Score range | Tier        |
|-------------|-------------|
| 0           | Unproven    |
| 1–9         | Novice      |
| 10–29       | Established |
| 30–74       | Trusted     |
| 75–149      | Verified    |
| 150+        | Elite       |

---

## Transfers

`leashed_transfer` checks the recipient's score before sending. If the score is below `minRepScore`, the call reverts with a human-readable message:

```
"alvin.leash has reputation score 4 — minimum required is 10"
```

Use `minRepScore: 0` to send to any registered agent unconditionally.

On success, the recipient's `successfulPayments` count and reputation score are updated atomically in the same transaction.

---

## Tasks

`record_task` allows any caller to log task outcomes for registered agents. This is the primary mechanism for agents to earn the higher +3 task score.

```
record_task("alvin.leash", success: true)  → score +3
record_task("alvin.leash", success: false) → score -2
```

---

## Leaderboard

Returns top N agents sorted by reputation score descending. Useful for:
- Discovering high-reputation agents to hire or pay
- Verifying your own rank before requesting high-threshold payments
- Displaying a trust leaderboard in a frontend

```
get_leaderboard(limit: 10) → [{ rank, username, wallet, reputationScore, ... }, ...]
```

---

## Contract Addresses (Pharos Testnet)

Set these in `.env` after running `npm run deploy`:

```
REGISTRY_ADDRESS=<AgentRegistry contract>
TRANSFER_ADDRESS=<LeashGatedTransfer contract>
```

Both contracts are verified on Pharos Testnet Explorer.
