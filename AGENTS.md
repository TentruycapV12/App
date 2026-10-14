# Guestbook

> Built with Arc Studio - money-powered apps in minutes

This is the **project memory** - what Arc Studio remembers about building this app. It helps future agents (or humans) understand and extend the project.

---

## What This App Does

Onchain class attendance / guestbook. Anyone can sign with their name and a short message. All entries are stored permanently onchain and displayed newest-first. Built on Arc Testnet.

## Deployed Contracts

| Contract | Address | Chain | Explorer |
|---|---|---|---|
| Guestbook | 0x6a0f02a94e4084f41b988dde5950794679d832c7 | Arc Testnet | https://explorer.testnet.arc.io/address/0x6a0f02a94e4084f41b988dde5950794679d832c7 |

## Tech Stack

- Frontend: React 18, Vite, TypeScript, Tailwind CSS
- Web3: wagmi v2, viem v2, ConnectKit
- Contracts: Solidity 0.8.28 + Foundry. Sources in `contracts/`, unit tests in `contracts/test/*.t.sol`. Build with `bun run contracts:build` (`forge build`), test with `bun run contracts:test` (`forge test`).
- Wallet: injected (MetaMask, etc.)
- Chain: Arc Testnet (Chain ID: 5042002, imported from `viem/chains`)
- Token: USDC (6 decimals) (Address: 0x3600000000000000000000000000000000000000, Chain: Arc Testnet)
- Toasts: Sonner

## Key Files

- `src/App.tsx` - Main application logic
- `src/components/` - UI components
- `src/config.ts` - wagmi config (chains, connectors, transports)

## To Run

```bash
bun install
bun run dev
```
