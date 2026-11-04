import { ConnectKitButton } from 'connectkit'
import { TokenUSDC } from '@web3icons/react'
import { useAccount } from 'wagmi'
import { formatUsdc } from '@/onchain-money'
import { useUsdcBalance } from '@/hooks/useGames'

export function Header() {
  const { isConnected } = useAccount()
  const { data: balance } = useUsdcBalance()

  return (
    <header className="mb-6 flex items-center justify-between gap-3">
      <div>
        <h1 className="display text-2xl font-bold text-[#122d45]">Tic Tac Toe</h1>
        <p className="text-xs text-[#6b6580]">Stake USDC. Gas is USDC too.</p>
      </div>
      <div className="flex items-center gap-2">
        {isConnected && balance !== undefined && (
          <span className="glass-pill flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold tabular-nums text-[#122d45]">
            <TokenUSDC variant="branded" size={16} />
            {formatUsdc(balance)}
          </span>
        )}
        <ConnectKitButton.Custom>
          {({ isConnected: connected, show, truncatedAddress }) => (
            <button
              type="button"
              onClick={show}
              className="min-h-[44px] rounded-full bg-[#122d45] px-4 text-xs font-semibold text-white transition-colors hover:bg-[#1061a6]"
            >
              {connected ? truncatedAddress : 'Connect'}
            </button>
          )}
        </ConnectKitButton.Custom>
      </div>
    </header>
  )
}
