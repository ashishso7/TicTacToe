import { parseAbi, type Address } from 'viem'
import { arcTestnet } from 'viem/chains'
import { getUsdc } from '@/onchain-facts'

export const CHAIN_ID = arcTestnet.id

const rawAddress = import.meta.env.VITE_TICTACTOE_ADDRESS as string | undefined
export const GAME_ADDRESS = (rawAddress ?? '') as Address

const usdcFact = getUsdc(CHAIN_ID)
if (!usdcFact) throw new Error(`USDC is not registered for chain ${CHAIN_ID}`)
export const USDC_ADDRESS = usdcFact.address as Address

export const GAME_ABI = parseAbi([
  'function createGame(uint256 stake) returns (uint256 id)',
  'function joinGame(uint256 id)',
  'function cancelGame(uint256 id)',
  'function play(uint256 id, uint8 cell)',
  'function claimTimeout(uint256 id)',
  'function withdrawCredit()',
  'function gameCount() view returns (uint256)',
  'function credits(address) view returns (uint256)',
  'function TURN_TIMEOUT() view returns (uint256)',
  'function getGame(uint256 id) view returns ((address playerX, address playerO, uint256 stake, uint8[9] board, address nextTurn, uint8 status, address winner, uint64 lastMoveAt))',
  'error ZeroAddress()',
  'error InvalidStake()',
  'error GameNotFound(uint256 id)',
  'error InvalidStatus(uint8 actual, uint8 expected)',
  'error Unauthorized()',
  'error SelfPlay()',
  'error InvalidCell(uint8 cell)',
  'error CellOccupied(uint8 cell)',
  'error TimeoutNotReached(uint256 deadline)',
  'error NoCredit()',
])

export const TURN_TIMEOUT_SECONDS = 300

export const Status = {
  Open: 0,
  Active: 1,
  Won: 2,
  Draw: 3,
  Cancelled: 4,
  TimedOut: 5,
} as const

export interface GameData {
  id: number
  playerX: Address
  playerO: Address
  stake: bigint
  board: readonly number[]
  nextTurn: Address
  status: number
  winner: Address
  lastMoveAt: bigint
}

export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

export const isSame = (a?: string, b?: string) =>
  !!a && !!b && a.toLowerCase() === b.toLowerCase()

export const shortAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`

export function isFinished(status: number) {
  return status >= Status.Won
}

export function statusLabel(game: GameData): string {
  switch (game.status) {
    case Status.Open:
      return 'Waiting for opponent'
    case Status.Active:
      return 'In play'
    case Status.Won:
      return 'Won'
    case Status.Draw:
      return 'Draw'
    case Status.Cancelled:
      return 'Cancelled'
    case Status.TimedOut:
      return 'Won by timeout'
    default:
      return 'Unknown'
  }
}

/** Short, user-friendly message for a failed wallet or contract call. */
export function parseTxError(error: unknown): string | null {
  const e = error as { code?: number; shortMessage?: string; message?: string } | undefined
  const text = `${e?.shortMessage ?? ''} ${e?.message ?? ''}`.toLowerCase()
  if (e?.code === 4001 || text.includes('user rejected') || text.includes('user denied')) return null
  if (text.includes('cellOccupied'.toLowerCase())) return 'That square is already taken.'
  if (text.includes('unauthorized')) return 'It is not your turn.'
  if (text.includes('timeoutnotreached')) return 'The opponent still has time to move.'
  if (text.includes('selfplay')) return 'You cannot join your own game.'
  if (text.includes('invalidstatus')) return 'This game has already moved on. Refreshing.'
  if (text.includes('insufficient funds') || text.includes('exceeds balance')) {
    return 'Not enough USDC. Use Get test USDC in the sidebar.'
  }
  if (text.includes('network') || text.includes('timeout')) return 'Network issue. Try again.'
  return e?.shortMessage ?? 'Transaction failed. Please try again.'
}
