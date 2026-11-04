import { motion } from 'framer-motion'

const LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
]

export function winningLine(board: readonly number[]): number[] | null {
  for (const line of LINES) {
    const [a, b, c] = line
    if (board[a] !== 0 && board[a] === board[b] && board[a] === board[c]) return line
  }
  return null
}

export function MarkX({ size = 44 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-label="X">
      <motion.path
        d="M10 10 L38 38"
        stroke="#122d45"
        strokeWidth="5"
        strokeLinecap="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.22 }}
      />
      <motion.path
        d="M38 10 L10 38"
        stroke="#122d45"
        strokeWidth="5"
        strokeLinecap="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.22, delay: 0.12 }}
      />
    </svg>
  )
}

export function MarkO({ size = 44 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-label="O">
      <motion.circle
        cx="24"
        cy="24"
        r="15"
        stroke="#1061a6"
        strokeWidth="5"
        strokeLinecap="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.3 }}
      />
    </svg>
  )
}

interface BoardProps {
  board: readonly number[]
  canPlay: boolean
  pendingCell: number | null
  onPlay: (cell: number) => void
}

export function Board({ board, canPlay, pendingCell, onPlay }: BoardProps) {
  const win = winningLine(board)
  return (
    <div className="grid grid-cols-3 gap-2.5">
      {board.map((value, cell) => {
        const empty = value === 0
        const isWin = win?.includes(cell) ?? false
        const clickable = canPlay && empty && pendingCell === null
        return (
          <button
            key={cell}
            type="button"
            disabled={!clickable}
            onClick={() => onPlay(cell)}
            aria-label={`Square ${cell + 1}${empty ? '' : value === 1 ? ', X' : ', O'}`}
            className="glass-inner relative flex aspect-square min-h-[88px] items-center justify-center rounded-2xl transition-colors enabled:hover:bg-white/80 enabled:active:scale-[0.97] disabled:cursor-default"
            style={isWin ? { background: 'rgba(126, 241, 179, 0.35)', borderColor: 'rgba(26,128,71,0.4)' } : undefined}
          >
            {value === 1 && <MarkX />}
            {value === 2 && <MarkO />}
            {empty && pendingCell === cell && (
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-[#85b1ed] border-t-transparent" />
            )}
            {empty && clickable && (
              <span className="pointer-events-none absolute h-2 w-2 rounded-full bg-[#122d45]/15" />
            )}
          </button>
        )
      })}
    </div>
  )
}
