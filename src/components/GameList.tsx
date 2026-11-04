import { useAccount } from 'wagmi'
import { ChevronRight, Hourglass } from 'lucide-react'
import { TokenUSDC } from '@web3icons/react'
import { formatUsdc } from '@/onchain-money'
import { useRecentGames } from '@/hooks/useGames'
import {
  Status,
  ZERO_ADDRESS,
  isFinished,
  isSame,
  shortAddress,
  statusLabel,
  type GameData,
} from '@/lib/tictactoe'

function Row({ game, me, onOpen }: { game: GameData; me?: string; onOpen: (id: number) => void }) {
  const mine = isSame(game.playerX, me) || isSame(game.playerO, me)
  const myTurn = game.status === Status.Active && isSame(game.nextTurn, me)
  const opponent = isSame(game.playerX, me) ? game.playerO : game.playerX
  const label = myTurn ? 'Your turn' : statusLabel(game)

  return (
    <li>
      <button
        type="button"
        onClick={() => onOpen(game.id)}
        className="glass-inner flex min-h-[56px] w-full items-center gap-3 rounded-2xl px-4 py-3 text-left transition-colors hover:bg-white/80"
      >
        <span className="display w-10 text-sm font-bold tabular-nums text-[#6b6580]">#{game.id}</span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5 text-sm font-semibold tabular-nums text-[#122d45]">
            <TokenUSDC variant="branded" size={14} />
            {formatUsdc(game.stake)}
            {myTurn && <span className="h-1.5 w-1.5 rounded-full bg-[#1a8047]" />}
          </span>
          <span className="block truncate text-xs text-[#6b6580]">
            {label}
            {mine && opponent !== ZERO_ADDRESS ? ` vs ${shortAddress(opponent)}` : ''}
            {!mine ? ` by ${shortAddress(game.playerX)}` : ''}
          </span>
        </span>
        <ChevronRight size={16} className="text-[#8a849c]" />
      </button>
    </li>
  )
}

function Group({ title, games, me, onOpen }: { title: string; games: GameData[]; me?: string; onOpen: (id: number) => void }) {
  if (games.length === 0) return null
  return (
    <div>
      <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#6b6580]">{title}</p>
      <ul className="space-y-2">
        {games.map((g) => (
          <Row key={g.id} game={g} me={me} onOpen={onOpen} />
        ))}
      </ul>
    </div>
  )
}

export function GameList({ onOpen }: { onOpen: (id: number) => void }) {
  const { address } = useAccount()
  const { games, isLoading } = useRecentGames()

  const mine = games.filter((g) => isSame(g.playerX, address) || isSame(g.playerO, address))
  const myLive = mine.filter((g) => !isFinished(g.status))
  const myDone = mine.filter((g) => isFinished(g.status)).slice(0, 5)
  const joinable = games.filter(
    (g) => g.status === Status.Open && !isSame(g.playerX, address),
  )

  const empty = !isLoading && myLive.length === 0 && joinable.length === 0 && myDone.length === 0

  return (
    <section className="space-y-5">
      <Group title="Your games" games={myLive} me={address} onOpen={onOpen} />
      <Group title="Open to join" games={joinable} me={address} onOpen={onOpen} />
      <Group title="Finished" games={myDone} me={address} onOpen={onOpen} />
      {isLoading && <p className="px-1 text-sm text-[#6b6580]">Loading games...</p>}
      {empty && (
        <div className="glass-inner flex items-center gap-3 rounded-2xl px-4 py-4 text-sm text-[#6b6580]">
          <Hourglass size={18} />
          No open games yet. Create one and share it with a friend.
        </div>
      )}
    </section>
  )
}
