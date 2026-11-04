import { useEffect, useState } from 'react'
import { useAccount } from 'wagmi'
import { erc20Abi } from 'viem'
import { ArrowLeft, Check, Copy, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'
import { ConnectKitButton } from 'connectkit'
import { TokenUSDC } from '@web3icons/react'
import { formatUsdc } from '@/onchain-money'
import { buildTxExplorerUrl } from '@/onchain-facts'
import { buildShareLink } from '@/lib/share'
import {
  CHAIN_ID,
  GAME_ABI,
  GAME_ADDRESS,
  TURN_TIMEOUT_SECONDS,
  USDC_ADDRESS,
  Status,
  ZERO_ADDRESS,
  isSame,
  shortAddress,
  type GameData,
} from '@/lib/tictactoe'
import { useAllowance, useGame, useUsdcBalance } from '@/hooks/useGames'
import { useNow } from '@/hooks/useNow'
import { useTx, type TxStep } from '@/hooks/useTx'
import { Board, MarkO, MarkX } from './Board'

function PlayerChip({ mark, address, me, active }: { mark: 'X' | 'O'; address: string; me?: string; active: boolean }) {
  const empty = address === ZERO_ADDRESS
  return (
    <div
      className={`glass-inner flex min-w-0 flex-1 items-center gap-2 rounded-2xl px-3 py-2.5 ${
        active ? 'ring-2 ring-[#85b1ed]' : ''
      }`}
    >
      {mark === 'X' ? <MarkX size={22} /> : <MarkO size={22} />}
      <span className="min-w-0">
        <span className="block truncate text-xs font-semibold text-[#122d45]">
          {empty ? 'Waiting...' : isSame(address, me) ? 'You' : shortAddress(address)}
        </span>
      </span>
    </div>
  )
}

function headline(game: GameData, me: string | undefined, overdue: boolean): { title: string; tone: 'neutral' | 'good' | 'bad' } {
  const iAmPlayer = isSame(game.playerX, me) || isSame(game.playerO, me)
  switch (game.status) {
    case Status.Open:
      return { title: isSame(game.playerX, me) ? 'Waiting for an opponent' : 'Open game', tone: 'neutral' }
    case Status.Active:
      if (!iAmPlayer) return { title: 'Game in progress', tone: 'neutral' }
      if (isSame(game.nextTurn, me)) return { title: 'Your turn', tone: 'good' }
      return { title: overdue ? 'Opponent ran out of time' : 'Opponent is thinking', tone: 'neutral' }
    case Status.Won:
    case Status.TimedOut:
      if (!iAmPlayer) return { title: `${shortAddress(game.winner)} won`, tone: 'neutral' }
      return isSame(game.winner, me)
        ? { title: 'You won the pot', tone: 'good' }
        : { title: 'You lost this one', tone: 'bad' }
    case Status.Draw:
      return { title: 'Draw. Stakes refunded', tone: 'neutral' }
    case Status.Cancelled:
      return { title: 'Game cancelled', tone: 'neutral' }
    default:
      return { title: 'Game', tone: 'neutral' }
  }
}

export function GameView({ id, onBack }: { id: number; onBack: () => void }) {
  const { address, isConnected } = useAccount()
  const { game, isLoading } = useGame(id)
  const { data: balance } = useUsdcBalance()
  const { data: allowance } = useAllowance()
  const { run, busy, lastHash } = useTx()
  const now = useNow()
  const [pendingCell, setPendingCell] = useState<number | null>(null)
  const [inviteLink, setInviteLink] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let live = true
    void buildShareLink(`/?game=${id}`).then((link) => {
      if (live) setInviteLink(link)
    })
    return () => {
      live = false
    }
  }, [id])

  if (isLoading || !game) {
    return (
      <div className="glass-card rounded-3xl p-6 text-sm text-[#6b6580]">
        <button type="button" onClick={onBack} className="mb-3 flex items-center gap-1 text-xs font-semibold">
          <ArrowLeft size={14} /> Lobby
        </button>
        Loading game #{id}...
      </div>
    )
  }

  const isX = isSame(game.playerX, address)
  const isO = isSame(game.playerO, address)
  const iAmPlayer = isX || isO
  const myTurn = game.status === Status.Active && isSame(game.nextTurn, address)
  const deadline = Number(game.lastMoveAt) + TURN_TIMEOUT_SECONDS
  const remaining = deadline - now
  const overdue = game.status === Status.Active && remaining <= 0
  const canClaim = game.status === Status.Active && iAmPlayer && !myTurn && overdue
  const pot = game.stake * 2n
  const head = headline(game, address, overdue)
  const needsApproval = (allowance ?? 0n) < game.stake
  const insufficient = balance !== undefined && balance < game.stake

  const mm = String(Math.max(0, Math.floor(remaining / 60))).padStart(1, '0')
  const ss = String(Math.max(0, remaining % 60)).padStart(2, '0')

  const play = async (cell: number) => {
    setPendingCell(cell)
    await run(
      [{ label: 'Place mark', address: GAME_ADDRESS, abi: GAME_ABI, functionName: 'play', args: [BigInt(id), cell] }],
      'Move confirmed.',
    )
    setPendingCell(null)
  }

  const join = () => {
    const steps: TxStep[] = []
    if (needsApproval) {
      steps.push({ label: 'Approve USDC', address: USDC_ADDRESS, abi: erc20Abi, functionName: 'approve', args: [GAME_ADDRESS, game.stake] })
    }
    steps.push({ label: 'Join game', address: GAME_ADDRESS, abi: GAME_ABI, functionName: 'joinGame', args: [BigInt(id)] })
    return run(steps, 'Joined. X moves first.')
  }

  const simple = (label: string, functionName: 'cancelGame' | 'claimTimeout', message: string) =>
    run([{ label, address: GAME_ADDRESS, abi: GAME_ABI, functionName, args: [BigInt(id)] }], message)

  const copy = async () => {
    if (!inviteLink) return
    try {
      await navigator.clipboard.writeText(inviteLink)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      toast.error('Could not copy. Select the link manually.')
    }
  }

  const primary =
    'min-h-[52px] w-full rounded-2xl bg-[#122d45] text-sm font-semibold text-white transition-colors enabled:hover:bg-[#1061a6] disabled:opacity-50'
  const ghost =
    'glass-pill min-h-[44px] w-full rounded-2xl text-sm font-semibold text-[#122d45] disabled:opacity-50'

  return (
    <section className="space-y-3">
      <button type="button" onClick={onBack} className="flex min-h-[44px] items-center gap-1 px-1 text-xs font-semibold text-[#334155]">
        <ArrowLeft size={14} /> Lobby
      </button>

      <div className="glass-card relative overflow-hidden rounded-3xl p-5">
        <div className="spectral absolute inset-x-0 top-0 h-[3px]" />
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#6b6580]">Game #{game.id}</p>
            <h2
              className="display mt-1 text-3xl font-bold text-balance"
              style={{ color: head.tone === 'good' ? '#1a8047' : head.tone === 'bad' ? '#ba2b4c' : '#122d45' }}
            >
              {head.title}
            </h2>
          </div>
          <div className="text-right">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#6b6580]">Pot</p>
            <p className="display flex items-center justify-end gap-1.5 text-xl font-bold tabular-nums text-[#122d45]">
              <TokenUSDC variant="branded" size={18} />
              {formatUsdc(game.status === Status.Open ? game.stake : pot)}
            </p>
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          <PlayerChip mark="X" address={game.playerX} me={address} active={game.status === Status.Active && isSame(game.nextTurn, game.playerX)} />
          <PlayerChip mark="O" address={game.playerO} me={address} active={game.status === Status.Active && isSame(game.nextTurn, game.playerO)} />
        </div>

        <div className="mt-4">
          <Board board={game.board} canPlay={myTurn && busy === null} pendingCell={pendingCell} onPlay={(cell) => void play(cell)} />
        </div>

        {game.status === Status.Active && (
          <p className="mt-3 text-center text-xs tabular-nums text-[#6b6580]">
            {overdue ? 'Turn timer expired' : `Turn timer ${mm}:${ss}`}
          </p>
        )}
      </div>

      <div className="space-y-2">
        {!isConnected && (
          <ConnectKitButton.Custom>
            {({ show }) => (
              <button type="button" onClick={show} className={primary}>
                Connect wallet
              </button>
            )}
          </ConnectKitButton.Custom>
        )}

        {isConnected && game.status === Status.Open && !isX && (
          <button type="button" onClick={() => void join()} disabled={busy !== null || insufficient} className={primary}>
            {busy ?? (insufficient ? 'Not enough USDC' : `Join for ${formatUsdc(game.stake)} USDC`)}
          </button>
        )}

        {isConnected && game.status === Status.Open && isX && (
          <>
            <button
              type="button"
              onClick={() => void copy()}
              disabled={!inviteLink}
              className={primary}
            >
              <span className="inline-flex items-center justify-center gap-2">
                {copied ? <Check size={16} /> : <Copy size={16} />}
                {copied ? 'Link copied' : 'Copy invite link'}
              </span>
            </button>
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => {
                void simple('Cancel game', 'cancelGame', 'Game cancelled. Stake returned.').then((ok) => {
                  if (ok) onBack()
                })
              }}
              className={ghost}
            >
              {busy ?? 'Cancel and refund stake'}
            </button>
          </>
        )}

        {canClaim && (
          <button type="button" disabled={busy !== null} onClick={() => void simple('Claim win', 'claimTimeout', 'Pot claimed.')} className={primary}>
            {busy ?? `Claim ${formatUsdc(pot)} USDC by timeout`}
          </button>
        )}

        {busy && game.status === Status.Active && (
          <p className="text-center text-xs text-[#6b6580]">{busy}...</p>
        )}

        {lastHash && (
          <a
            href={buildTxExplorerUrl(CHAIN_ID, lastHash)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-[44px] items-center justify-center gap-1 text-xs font-semibold text-[#1061a6]"
          >
            View last transaction <ExternalLink size={12} />
          </a>
        )}
      </div>
    </section>
  )
}
