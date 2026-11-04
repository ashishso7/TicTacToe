# USDC Tic Tac Toe

A two-player tic-tac-toe game on Arc Testnet. Each player stakes USDC, the winner takes the pot, a draw refunds both, and a player who stops moving can be timed out. Gas is paid in USDC too.

Built with [Arc Studio](https://studio.arc.io)

Live app: https://ashiis0-app-75394a35-15ce-4784-9247-03dd8faac47a.static.hf.space

The game contract is deployed on Arc Testnet at `0x270377688810d15ad831d5ff3808a6ba66030e79` ([view on the explorer](https://explorer.testnet.arc.io/address/0x270377688810d15ad831d5ff3808a6ba66030e79)).

## Tech stack

- React, Vite, TypeScript, Tailwind CSS
- wagmi, viem, ConnectKit
- Solidity (Foundry, OpenZeppelin) on Arc Testnet

## Development

Prerequisites: [Bun](https://bun.sh) and [Foundry](https://getfoundry.sh).

```bash
bun install
bun run dev
```

Other commands: `bun run build`, `bun run check` (lint and typecheck), `bun run contracts:build`, `bun run contracts:test`.

### Environment variables

- `VITE_TICTACTOE_ADDRESS`: address of the deployed game contract on Arc Testnet.
- `RPC_PROXY_BASE_URL`, `RPC_PROXY_TOKEN`, `RPC_PROXY_CHAINS`: provisioned by Arc Studio, optional outside it.

## Playing

1. Connect a wallet on Arc Testnet and get test USDC.
2. Create a game with a stake, or join an open one.
3. Take turns. Three in a row wins the pot.
