import { useCallback, useState } from 'react'
import { useAccount } from 'wagmi'
import { AlertTriangle } from 'lucide-react'
import { formatUsdc } from '@/onchain-money'
import { GAME_ABI, GAME_ADDRESS } from '@/lib/tictactoe'
import { useCredits } from '@/hooks/useGames'
import { useTx } from '@/hooks/useTx'
import { Header } from '@/components/Header'
import { CreateGame } from '@/components/CreateGame'
import { GameList } from '@/components/GameList'
import { GameView } from '@/components/GameView'

function readGameFromUrl(): number | null {
  const raw = new URLSearchParams(window.location.search).get('game')
  const id = raw ? Number.parseInt(raw, 10) : NaN
  return Number.isInteger(id) && id > 0 ? id : null
}

function setUrlGame(id: number | null) {
  const url = new URL(window.location.href)
  if (id) url.searchParams.set('game', String(id))
  else url.searchParams.delete('game')
  window.history.replaceState(null, '', url)
}

function CreditsBanner() {
  const { isConnected } = useAccount()
  const { data: credits } = useCredits()
  const { run, busy } = useTx()
  if (!isConnected || !credits || credits === 0n) return null
  return (
    <div className="glass-card mb-3 flex items-center gap-3 rounded-2xl p-4">
      <AlertTriangle size={18} className="shrink-0 text-[#ba2b4c]" />
      <p className="flex-1 text-xs text-[#334155]">
        <span className="font-semibold tabular-nums">{formatUsdc(credits)} USDC</span> could not be sent to your wallet and is waiting for you.
      </p>
      <button
        type="button"
        disabled={busy !== null}
        onClick={() =>
          void run([{ label: 'Withdraw', address: GAME_ADDRESS, abi: GAME_ABI, functionName: 'withdrawCredit' }], 'Withdrawn to your wallet.')
        }
        className="min-h-[44px] rounded-full bg-[#122d45] px-4 text-xs font-semibold text-white disabled:opacity-50"
      >
        {busy ?? 'Withdraw'}
      </button>
    </div>
  )
}

export default function App() {
  const [gameId, setGameId] = useState<number | null>(readGameFromUrl)

  const open = useCallback((id: number | null) => {
    setGameId(id)
    setUrlGame(id)
  }, [])

  return (
    <div
      className="relative min-h-dvh overflow-hidden"
      style={{ background: 'linear-gradient(180deg, #f9f9fc 0%, #fffcf7 52%, #fbf7f2 100%)' }}
    >
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div
          className="absolute"
          style={{ top: '8%', left: '5%', width: 280, height: 280, borderRadius: '50%', background: 'radial-gradient(circle, rgba(133,177,237,0.22) 0%, transparent 70%)', filter: 'blur(60px)' }}
        />
        <div
          className="absolute"
          style={{ bottom: '8%', right: '8%', width: 260, height: 260, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,205,131,0.20) 0%, transparent 70%)', filter: 'blur(58px)' }}
        />
      </div>

      <div className="relative z-10 mx-auto max-w-md px-4 pb-24 pt-6">
        <Header />
        <CreditsBanner />
        {!GAME_ADDRESS ? (
          <p className="glass-card rounded-2xl p-4 text-sm text-[#ba2b4c]">
            The game contract address is not configured.
          </p>
        ) : gameId ? (
          <GameView id={gameId} onBack={() => open(null)} />
        ) : (
          <main className="space-y-6">
            <CreateGame onCreated={(id) => open(id)} />
            <GameList onOpen={(id) => open(id)} />
          </main>
        )}
      </div>
    </div>
  )
}
