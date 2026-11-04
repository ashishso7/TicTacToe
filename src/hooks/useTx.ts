import { useCallback, useState } from 'react'
import { useAccount, usePublicClient, useSwitchChain, useWalletClient } from 'wagmi'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { Abi, Address, Hash } from 'viem'
import { arcTestnet } from 'viem/chains'
import { CHAIN_ID, parseTxError } from '@/lib/tictactoe'

export interface TxStep {
  /** Shown while this step is waiting on the wallet or the chain. */
  label: string
  address: Address
  abi: Abi
  functionName: string
  args?: readonly unknown[]
}

/** Runs one or more contract calls in order, waiting for each receipt. */
export function useTx() {
  const { address, chainId } = useAccount()
  const { switchChainAsync } = useSwitchChain()
  const { data: walletClient } = useWalletClient()
  const publicClient = usePublicClient({ chainId: CHAIN_ID })
  const queryClient = useQueryClient()
  const [busy, setBusy] = useState<string | null>(null)
  const [lastHash, setLastHash] = useState<Hash | null>(null)

  const run = useCallback(
    async (steps: TxStep[], successMessage: string): Promise<boolean> => {
      if (!address || !walletClient || !publicClient) {
        toast.error('Connect your wallet first.')
        return false
      }
      try {
        if (chainId !== CHAIN_ID) {
          setBusy('Switching network')
          await switchChainAsync({ chainId: CHAIN_ID })
        }
        for (const step of steps) {
          setBusy(step.label)
          const hash = await walletClient.writeContract({
            account: address,
            chain: arcTestnet,
            address: step.address,
            abi: step.abi,
            functionName: step.functionName,
            args: step.args,
          })
          setLastHash(hash)
          setBusy(`Confirming: ${step.label}`)
          const receipt = await publicClient.waitForTransactionReceipt({ hash })
          if (receipt.status !== 'success') throw new Error('Transaction reverted')
        }
        toast.success(successMessage)
        await queryClient.invalidateQueries()
        return true
      } catch (error) {
        const message = parseTxError(error)
        if (message) toast.error(message)
        await queryClient.invalidateQueries()
        return false
      } finally {
        setBusy(null)
      }
    },
    [address, chainId, walletClient, publicClient, switchChainAsync, queryClient],
  )

  return { run, busy, lastHash }
}
