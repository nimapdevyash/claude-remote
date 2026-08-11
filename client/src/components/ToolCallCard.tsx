import { useState, type ComponentType } from 'react'
import {
  Bot,
  Check,
  ChevronDown,
  FileText,
  FilePenLine,
  FilePlus,
  FolderSearch,
  Globe,
  Search,
  Terminal,
  Wrench,
  X as XIcon,
} from 'lucide-react'
import type { ToolBlock } from '../lib/deriveBlocks'
import { toolSummary } from '../lib/format'

const ICONS: Record<string, ComponentType<{ size?: number }>> = {
  Bash: Terminal,
  Read: FileText,
  Edit: FilePenLine,
  Write: FilePlus,
  Glob: FolderSearch,
  Grep: Search,
  WebFetch: Globe,
  WebSearch: Search,
  Task: Bot,
}

export function ToolCallCard({ block }: { block: ToolBlock }) {
  const [open, setOpen] = useState(false)
  const Icon = ICONS[block.name] || Wrench
  const summary = toolSummary(block.name, block.input)

  return (
    <div className="max-w-2xl overflow-hidden rounded-xl border border-base-800 bg-base-900">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-base-800 text-base-300">
          <Icon size={13} />
        </span>
        <span className="text-sm font-medium text-base-100">{block.name}</span>
        <span className="min-w-0 flex-1 truncate font-mono text-xs text-base-500">{summary}</span>
        {block.pending ? (
          <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-accent-400" />
        ) : block.isError ? (
          <XIcon size={14} className="shrink-0 text-bad-500" />
        ) : (
          <Check size={14} className="shrink-0 text-good-500" />
        )}
        <ChevronDown size={14} className={`shrink-0 text-base-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="space-y-2 border-t border-base-800 bg-base-950/50 px-3.5 py-3">
          <div>
            <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-base-500">Input</p>
            <pre className="overflow-x-auto whitespace-pre-wrap break-all rounded-lg bg-base-950 p-2.5 font-mono text-xs text-base-300">
              {JSON.stringify(block.input, null, 2)}
            </pre>
          </div>
          {block.result !== null && (
            <div>
              <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-base-500">
                {block.isError ? 'Error' : 'Result'}
              </p>
              <pre
                className={`max-h-64 overflow-auto whitespace-pre-wrap break-all rounded-lg p-2.5 font-mono text-xs ${
                  block.isError ? 'bg-bad-500/10 text-bad-500' : 'bg-base-950 text-base-300'
                }`}
              >
                {block.result}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
