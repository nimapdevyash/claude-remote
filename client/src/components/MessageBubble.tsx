import { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'

export function UserBubble({ text }: { text: string }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-2xl rounded-2xl rounded-tr-sm bg-accent-600 px-4 py-2.5 text-sm text-white">
        <p className="whitespace-pre-wrap">{text}</p>
      </div>
    </div>
  )
}

export function AssistantText({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard API unavailable (e.g. non-secure context) — nothing to fall back to.
    }
  }

  return (
    <div className="max-w-2xl">
      <div className="rounded-2xl rounded-tl-sm border border-base-800 bg-base-900 px-4 py-3 text-sm text-base-100">
        <div className="prose-chat">
          <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
            {text}
          </ReactMarkdown>
        </div>
      </div>
      <button
        onClick={handleCopy}
        className="mt-1.5 flex items-center gap-1.5 rounded-md px-1.5 py-1 text-xs text-base-500 transition hover:bg-base-800 hover:text-base-200"
      >
        {copied ? <Check size={13} className="text-good-500" /> : <Copy size={13} />}
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  )
}
