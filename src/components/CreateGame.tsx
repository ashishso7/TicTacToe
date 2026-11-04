import { useState } from 'react'
import { useAccount, usePublicClient } from 'wagmi'
import { erc20Abi } from 'viem'
import { ConnectKitButton } from 'connectkit'
import { formatUsdc, parseUsdc } from '@/onchain-money'
import { CHAIN_ID, GAME_ABI, GAME_ADDRESS, USDC_ADDRESS } from '@/lib/tictactoe'
import { useAllowance, useUsdcBalance } from '@/hooks/useGames'
import { useTx, type TxStep } from '@/hooks/useTx'

const PRESETS = ['0.1', '0.5', '1', '5']

export function CreateGame({ onCreated }: { onCreated: (id: number) => void }) {
  const { isConnected } = useAccount()
  const publicClient = usePublicClient({ chainId: CHAIN_ID })
  const [amount, setAmount] = useState('0.5')
  const { data: balance } = useUsdcBalance()
  const { data: allowance } = useAllowance()
  const { run, busy } = useTx()

  let stake: bigint | null = null
  let error: string | null = null
  try {
    stake = parseUsdc(amount)
    if (stake <= 0n) {
      stake = null
      error = 'Enter a stake above 0.'
    }
  } catch {
    error = 'Enter a valid USDC amount.'
  }
  const insufficient = stake !== null && balance !== undefined && balance < stake

  const create = async () => {
    if (stake === null) return
    const steps: TxStep[] = []
    if ((allowance ?? 0n) < stake) {
      steps.push({
        label: 'Approve USDC',
        address: USDC_ADDRESS,
        abi: erc20Abi,
        functionName: 'approve',
        args: [GAME_ADDRESS, stake],
      })
    }
    steps.push({
      label: 'Create game',
      address: GAME_ADDRESS,
      abi: GAME_ABI,
      functionName: 'createGame',
      args: [stake],
    })
    const ok = await run(steps, 'Game created. Share it or wait for an opponent.')
    if (!ok || !publicClient) return
    const count = await publicClient.readContract({
      address: GAME_ADDRESS,
      abi: GAME_ABI,
      functionName: 'gameCount',
    })
    onCreated(Number(count))
  }

  return (
    <section className="glass-card relative overflow-hidden rounded-3xl p-5">
      <div className="spectral absolute inset-x-0 top-0 h-[3px]" />
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#6b6580]">New game</p>
      <div className="mt-2 flex items-baseline gap-2">
        <input
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
          aria-label="Stake in USDC"
          className="display w-full bg-transparent text-5xl font-bold tabular-nums text-[#122d45] outline-none"
        />
        <span className="text-sm font-semibold text-[#6b6580]">USDC</span>
      </div>
      <p className="mt-1 text-xs text-[#6b6580]">
        Each player stakes this amount. Winner takes{' '}
        <span className="font-semibold tabular-nums text-[#122d45]">
          {stake !== null ? formatUsdc(stake * 2n) : '0'} USDC
        </span>
        ; a draw refunds both.
      </p>

      <div className="mt-4 flex gap-2">
        {PRESETS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setAmount(p)}
            className={`glass-pill min-h-[44px] flex-1 rounded-full text-sm font-semibold tabular-nums transition-colors ${
              amount === p ? 'border-[#122d45]/50 text-[#122d45]' : 'text-[#334155]'
            }`}
          >
            {p}
          </button>
        ))}
      </div>

      <div className="mt-4">
        {!isConnected ? (
          <ConnectKitButton.Custom>
            {({ show }) => (
              <button
                type="button"
                onClick={show}
                className="min-h-[52px] w-full rounded-2xl bg-[#122d45] text-sm font-semibold text-white hover:bg-[#1061a6]"
              >
                Connect wallet to play
              </button>
            )}
          </ConnectKitButton.Custom>
        ) : (
          <button
            type="button"
            onClick={() => void create()}
            disabled={busy !== null || stake === null || insufficient}
            className="min-h-[52px] w-full rounded-2xl bg-[#122d45] text-sm font-semibold text-white transition-colors enabled:hover:bg-[#1061a6] disabled:opacity-50"
          >
            {busy ?? (insufficient ? 'Not enough USDC' : 'Create game')}
          </button>
        )}
        {error && <p className="mt-2 text-xs text-[#ba2b4c]">{error}</p>}
        {insufficient && (
          <p className="mt-2 text-xs text-[#6b6580]">
            Need test USDC? Use Get test USDC in the Arc Studio sidebar.
          </p>
        )}
      </div>
    </section>
  )
}
