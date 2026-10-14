import { useState, useEffect, useCallback } from 'react'
import { ConnectKitButton } from 'connectkit'
import {
  useAccount,
  useWriteContract,
  useWaitForTransactionReceipt,
  useReadContract,
  useSwitchChain,
} from 'wagmi'
import { toast } from 'sonner'
import { BookOpen, PenLine, RefreshCw, ExternalLink, Clock, User, ChevronLeft, ChevronRight } from 'lucide-react'
import { buildTxExplorerUrl, requireChain } from '@/onchain-facts'

// ---- Contract config ----
const ARC_TESTNET_CHAIN_ID = 5042002
const GUESTBOOK_ADDRESS = '0x6a0f02a94e4084f41b988dde5950794679d832c7' as `0x${string}`
const CONTRACT_DEPLOYED = true

const GUESTBOOK_ABI = [
  {
    name: 'sign',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'name', type: 'string' },
      { name: 'message', type: 'string' },
    ],
    outputs: [],
  },
  {
    name: 'getEntries',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'offset', type: 'uint256' },
      { name: 'limit', type: 'uint256' },
    ],
    outputs: [
      {
        name: '',
        type: 'tuple[]',
        components: [
          { name: 'signer', type: 'address' },
          { name: 'name', type: 'string' },
          { name: 'message', type: 'string' },
          { name: 'timestamp', type: 'uint256' },
        ],
      },
    ],
  },
  {
    name: 'getEntryCount',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'Signed',
    type: 'event',
    inputs: [
      { name: 'signer', type: 'address', indexed: true },
      { name: 'name', type: 'string', indexed: false },
      { name: 'message', type: 'string', indexed: false },
      { name: 'timestamp', type: 'uint256', indexed: false },
    ],
  },
] as const

type Entry = {
  signer: `0x${string}`
  name: string
  message: string
  timestamp: bigint
}

const PAGE_SIZE = 10

function formatAddress(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

function formatTimestamp(ts: bigint) {
  const date = new Date(Number(ts) * 1000)
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function parseOnchainError(error: unknown): string {
  const msg = (error as { message?: string })?.message?.toLowerCase() ?? ''
  if (msg.includes('user rejected') || msg.includes('denied')) return 'Transaction cancelled.'
  if (msg.includes('nameempty')) return 'Name cannot be empty.'
  if (msg.includes('messageempty')) return 'Message cannot be empty.'
  if (msg.includes('nametoolong')) return 'Name must be 50 characters or fewer.'
  if (msg.includes('messagetoolong')) return 'Message must be 200 characters or fewer.'
  if (msg.includes('insufficient funds') || msg.includes('exceeds balance')) return 'Insufficient balance for gas.'
  if (msg.includes('network') || msg.includes('timeout')) return 'Network error. Please try again.'
  return 'Something went wrong. Please try again.'
}

// ---- Guestbook Entry Card ----
function EntryCard({ entry, index }: { entry: Entry; index: number }) {
  return (
    <div
      className="rounded-2xl p-5 flex flex-col gap-2 transition-all"
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        animationDelay: `${index * 40}ms`,
      }}
    >
      <p
        className="text-sm leading-relaxed"
        style={{ color: 'var(--ink)', fontFamily: "'DM Sans', sans-serif" }}
      >
        "{entry.message}"
      </p>
      <div className="flex items-center gap-3 mt-1 flex-wrap">
        <div className="flex items-center gap-1.5">
          <User size={12} style={{ color: 'var(--accent)' }} />
          <span
            className="text-xs font-medium"
            style={{ color: 'var(--accent)', fontFamily: "'DM Sans', sans-serif" }}
          >
            {entry.name}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span
            className="text-xs mono"
            style={{ color: 'var(--subtle)' }}
          >
            {formatAddress(entry.signer)}
          </span>
        </div>
        <div className="flex items-center gap-1.5 ml-auto">
          <Clock size={11} style={{ color: 'var(--subtle)' }} />
          <span
            className="text-xs"
            style={{ color: 'var(--subtle)', fontFamily: "'DM Sans', sans-serif" }}
          >
            {formatTimestamp(entry.timestamp)}
          </span>
        </div>
      </div>
    </div>
  )
}

// ---- Sign Form ----
function SignForm({ onSigned }: { onSigned: () => void }) {
  const { address, chainId } = useAccount()
  const { switchChain } = useSwitchChain()
  const [name, setName] = useState('')
  const [message, setMessage] = useState('')

  const { writeContract, data: hash, isPending, isError, error, reset } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  const isWrongChain = address != null && chainId !== ARC_TESTNET_CHAIN_ID
  const isNotDeployed = !CONTRACT_DEPLOYED

  // Reset form state after a confirmed success (no setState — tracked via ref)
  const prevSuccess = useState(false)
  if (isSuccess && !prevSuccess[0]) {
    prevSuccess[1](true)
    toast.success('Your entry was signed onchain!')
    onSigned()
  }
  if (!isSuccess && prevSuccess[0]) {
    prevSuccess[1](false)
    setName('')
    setMessage('')
  }

  useEffect(() => {
    if (isError && error) {
      toast.error(parseOnchainError(error))
      reset()
    }
  }, [isError, error, reset])

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      if (!address) return
      if (isWrongChain) {
        switchChain({ chainId: ARC_TESTNET_CHAIN_ID })
        return
      }
      if (!name.trim() || !message.trim()) {
        toast.error('Both name and message are required.')
        return
      }
      writeContract({
        address: GUESTBOOK_ADDRESS,
        abi: GUESTBOOK_ABI,
        functionName: 'sign',
        args: [name.trim(), message.trim()],
      })
    },
    [address, isWrongChain, name, message, switchChain, writeContract]
  )

  const isBusy = isPending || isConfirming
  const nameTooLong = name.length > 50
  const msgTooLong = message.length > 200

  if (isNotDeployed) return null

  if (!address) {
    return (
      <div
        className="rounded-2xl p-6 flex flex-col items-center gap-4 text-center"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
      >
        <PenLine size={32} style={{ color: 'var(--accent)' }} />
        <p className="text-sm" style={{ color: 'var(--muted)' }}>
          Connect your wallet to sign the guestbook.
        </p>
        <ConnectKitButton />
      </div>
    )
  }

  if (isWrongChain) {
    return (
      <div
        className="rounded-2xl p-5 flex flex-col gap-3"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
      >
        <p className="text-sm" style={{ color: 'var(--muted)' }}>
          Switch to Arc Testnet to sign the guestbook.
        </p>
        <button
          onClick={() => switchChain({ chainId: ARC_TESTNET_CHAIN_ID })}
          className="px-4 py-2 rounded-xl text-sm font-medium transition-colors"
          style={{
            background: 'var(--accent)',
            color: '#0d1b2f',
            border: 'none',
            cursor: 'pointer',
            fontFamily: "'DM Sans', sans-serif",
          }}
        >
          Switch to Arc Testnet
        </button>
      </div>
    )
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl p-5 flex flex-col gap-4"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
    >
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="gb-name"
          className="text-xs font-semibold uppercase tracking-wider"
          style={{ color: 'var(--subtle)', letterSpacing: '0.08em' }}
        >
          Your Name
        </label>
        <input
          id="gb-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Alex Chen"
          maxLength={55}
          disabled={isBusy}
          className="rounded-xl px-4 py-3 text-sm outline-none transition-all disabled:opacity-50"
          style={{
            background: 'var(--surface-muted)',
            border: `1px solid ${nameTooLong ? 'var(--danger)' : 'var(--border)'}`,
            color: 'var(--ink)',
            fontFamily: "'DM Sans', sans-serif",
          }}
        />
        <span
          className="text-xs text-right tabular-nums"
          style={{ color: nameTooLong ? 'var(--danger)' : 'var(--subtle)' }}
        >
          {name.length}/50
        </span>
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="gb-msg"
          className="text-xs font-semibold uppercase tracking-wider"
          style={{ color: 'var(--subtle)', letterSpacing: '0.08em' }}
        >
          Message
        </label>
        <textarea
          id="gb-msg"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Leave a note or mark your attendance…"
          maxLength={210}
          rows={3}
          disabled={isBusy}
          className="rounded-xl px-4 py-3 text-sm outline-none resize-none transition-all disabled:opacity-50"
          style={{
            background: 'var(--surface-muted)',
            border: `1px solid ${msgTooLong ? 'var(--danger)' : 'var(--border)'}`,
            color: 'var(--ink)',
            fontFamily: "'DM Sans', sans-serif",
          }}
        />
        <span
          className="text-xs text-right tabular-nums"
          style={{ color: msgTooLong ? 'var(--danger)' : 'var(--subtle)' }}
        >
          {message.length}/200
        </span>
      </div>

      {hash && (isConfirming || isSuccess) && (
        <a
          href={buildTxExplorerUrl(ARC_TESTNET_CHAIN_ID, hash)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-xs"
          style={{ color: 'var(--accent)' }}
        >
          <ExternalLink size={12} />
          {isConfirming ? 'Confirming on Arc Testnet…' : 'View on explorer'}
        </a>
      )}

      <button
        type="submit"
        disabled={isBusy || nameTooLong || msgTooLong || !name.trim() || !message.trim()}
        className="flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        style={{
          background: 'var(--accent)',
          color: '#0d1b2f',
          border: 'none',
          cursor: isBusy ? 'wait' : 'pointer',
          fontFamily: "'DM Sans', sans-serif",
          minHeight: '44px',
        }}
      >
        <PenLine size={15} />
        {isPending
          ? 'Confirm in wallet…'
          : isConfirming
          ? 'Confirming…'
          : 'Sign the Guestbook'}
      </button>
    </form>
  )
}

// ---- Entries List ----
function EntriesList({ refreshKey }: { refreshKey: number }) {
  const [page, setPage] = useState(0)

  const {
    data: countData,
    refetch: refetchCount,
  } = useReadContract({
    address: GUESTBOOK_ADDRESS,
    abi: GUESTBOOK_ABI,
    functionName: 'getEntryCount',
    chainId: ARC_TESTNET_CHAIN_ID,
    query: { enabled: CONTRACT_DEPLOYED },
  })

  const totalCount = countData != null ? Number(countData) : 0
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  const offset = BigInt(page * PAGE_SIZE)
  const limit = BigInt(PAGE_SIZE)

  const {
    data: entries,
    isLoading,
    refetch: refetchEntries,
  } = useReadContract({
    address: GUESTBOOK_ADDRESS,
    abi: GUESTBOOK_ABI,
    functionName: 'getEntries',
    args: [offset, limit],
    chainId: ARC_TESTNET_CHAIN_ID,
    query: { enabled: CONTRACT_DEPLOYED && totalCount > 0 },
  })

  useEffect(() => {
    if (CONTRACT_DEPLOYED) {
      void refetchCount()
      void refetchEntries()
    }
  }, [refreshKey, refetchCount, refetchEntries])

  const handleRefresh = () => {
    void refetchCount()
    void refetchEntries()
  }

  const chain = requireChain(ARC_TESTNET_CHAIN_ID)

  if (!CONTRACT_DEPLOYED) {
    return (
      <div className="flex flex-col items-center gap-3 py-12" style={{ color: 'var(--subtle)' }}>
        <BookOpen size={32} style={{ color: 'var(--border-strong)' }} />
        <p className="text-sm">Contract deploying — entries will appear here.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium tabular-nums" style={{ color: 'var(--muted)' }}>
          {totalCount > 0 ? (
            <>
              {totalCount} {totalCount === 1 ? 'entry' : 'entries'}
            </>
          ) : (
            'No entries yet'
          )}
        </span>
        <button
          onClick={handleRefresh}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors"
          style={{
            color: 'var(--subtle)',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            cursor: 'pointer',
            fontFamily: "'DM Sans', sans-serif",
          }}
        >
          <RefreshCw size={12} />
          Refresh
        </button>
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="rounded-2xl p-5 h-24 animate-pulse"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
            />
          ))}
        </div>
      ) : entries && entries.length > 0 ? (
        <>
          <div className="flex flex-col gap-3">
            {(entries as Entry[]).map((entry, i) => (
              <EntryCard key={`${entry.signer}-${entry.timestamp.toString()}-${i}`} entry={entry} index={i} />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-1">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="flex items-center gap-1 text-xs px-3 py-2 rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                style={{
                  color: 'var(--muted)',
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  cursor: page === 0 ? 'not-allowed' : 'pointer',
                }}
              >
                <ChevronLeft size={13} />
                Newer
              </button>
              <span className="text-xs tabular-nums" style={{ color: 'var(--subtle)' }}>
                Page {page + 1} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="flex items-center gap-1 text-xs px-3 py-2 rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                style={{
                  color: 'var(--muted)',
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  cursor: page >= totalPages - 1 ? 'not-allowed' : 'pointer',
                }}
              >
                Older
                <ChevronRight size={13} />
              </button>
            </div>
          )}
        </>
      ) : (
        <div
          className="rounded-2xl p-10 flex flex-col items-center gap-3 text-center"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        >
          <BookOpen size={28} style={{ color: 'var(--border-strong)' }} />
          <p className="text-sm" style={{ color: 'var(--subtle)' }}>
            Be the first to sign!
          </p>
        </div>
      )}

      <p className="text-xs text-center" style={{ color: 'var(--subtle)' }}>
        Stored onchain on{' '}
        <a
          href={chain.explorerBase}
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2"
          style={{ color: 'var(--accent)' }}
        >
          Arc Testnet
        </a>
      </p>
    </div>
  )
}

// ---- Root App ----
export default function App() {
  const [refreshKey, setRefreshKey] = useState(0)

  const triggerRefresh = useCallback(() => {
    setRefreshKey((k) => k + 1)
  }, [])

  return (
    <div
      className="min-h-dvh"
      style={{ background: 'var(--bg-gradient)' }}
    >
      <div className="max-w-xl mx-auto px-4 pt-8 pb-16">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: 'var(--surface-strong)', border: '1px solid var(--border)' }}
            >
              <BookOpen size={18} style={{ color: 'var(--accent)' }} />
            </div>
            <div>
              <h1
                className="display text-lg font-600 leading-tight"
                style={{ color: 'var(--ink)', letterSpacing: '-0.02em' }}
              >
                Guestbook
              </h1>
              <p className="text-xs" style={{ color: 'var(--subtle)' }}>
                Arc Testnet
              </p>
            </div>
          </div>
          <ConnectKitButton />
        </div>

        {/* Sign card */}
        <div className="mb-6">
          <h2
            className="text-xs font-semibold uppercase tracking-widest mb-3"
            style={{ color: 'var(--subtle)', letterSpacing: '0.08em' }}
          >
            Sign
          </h2>
          <SignForm onSigned={triggerRefresh} />
        </div>

        {/* Entries */}
        <div>
          <h2
            className="text-xs font-semibold uppercase tracking-widest mb-3"
            style={{ color: 'var(--subtle)', letterSpacing: '0.08em' }}
          >
            Entries
          </h2>
          <EntriesList refreshKey={refreshKey} />
        </div>
      </div>
    </div>
  )
}
