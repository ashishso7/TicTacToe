import { useMemo } from 'react'
import { useAccount, useReadContract, useReadContracts } from 'wagmi'
import { erc20Abi } from 'viem'
import {
  CHAIN_ID,
  GAME_ABI,
  GAME_ADDRESS,
  USDC_ADDRESS,
  type GameData,
} from '@/lib/tictactoe'

const WINDOW = 30
const POLL_MS = 3000

export function useUsdcBalance() {
  const { address } = useAccount()
  return useReadContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: CHAIN_ID,
    query: { enabled: !!address, refetchInterval: POLL_MS },
  })
}

export function useAllowance() {
  const { address } = useAccount()
  return useReadContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: 'allowance',
    args: address ? [address, GAME_ADDRESS] : undefined,
    chainId: CHAIN_ID,
    query: { enabled: !!address, refetchInterval: POLL_MS },
  })
}

export function useCredits() {
  const { address } = useAccount()
  return useReadContract({
    address: GAME_ADDRESS,
    abi: GAME_ABI,
    functionName: 'credits',
    args: address ? [address] : undefined,
    chainId: CHAIN_ID,
    query: { enabled: !!address, refetchInterval: POLL_MS },
  })
}

/** The most recent games, newest first. */
export function useRecentGames() {
  const { data: count, isLoading: countLoading } = useReadContract({
    address: GAME_ADDRESS,
    abi: GAME_ABI,
    functionName: 'gameCount',
    chainId: CHAIN_ID,
    query: { refetchInterval: POLL_MS },
  })

  const ids = useMemo(() => {
    const total = Number(count ?? 0n)
    const out: number[] = []
    for (let id = total; id >= 1 && out.length < WINDOW; id--) out.push(id)
    return out
  }, [count])

  const { data, isLoading } = useReadContracts({
    contracts: ids.map((id) => ({
      address: GAME_ADDRESS,
      abi: GAME_ABI,
      functionName: 'getGame' as const,
      args: [BigInt(id)] as const,
      chainId: CHAIN_ID,
    })),
    query: { enabled: ids.length > 0, refetchInterval: POLL_MS },
  })

  const games = useMemo<GameData[]>(() => {
    if (!data) return []
    const out: GameData[] = []
    data.forEach((entry, i) => {
      if (entry.status !== 'success') return
      const g = entry.result
      out.push({
        id: ids[i],
        playerX: g.playerX,
        playerO: g.playerO,
        stake: g.stake,
        board: g.board,
        nextTurn: g.nextTurn,
        status: g.status,
        winner: g.winner,
        lastMoveAt: g.lastMoveAt,
      })
    })
    return out
  }, [data, ids])

  return { games, isLoading: countLoading || (ids.length > 0 && isLoading) }
}

export function useGame(id: number | null) {
  const { data, isLoading } = useReadContract({
    address: GAME_ADDRESS,
    abi: GAME_ABI,
    functionName: 'getGame',
    args: id ? [BigInt(id)] : undefined,
    chainId: CHAIN_ID,
    query: { enabled: !!id, refetchInterval: 2000 },
  })
  const game = useMemo<GameData | null>(() => {
    if (!data || !id) return null
    return { id, ...data }
  }, [data, id])
  return { game, isLoading }
}
