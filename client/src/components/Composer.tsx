import { useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react'
import { ArrowUp } from 'lucide-react'

type Props = {
  disabled: boolean
  onSend: (prompt: string) => void
}

export function Composer({ disabled, onSend }: Props) {
  const [value, setValue] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  function submit() {
    const trimmed = value.trim()
    if (!trimmed || disabled) return
    onSend(trimmed)
    setValue('')
    requestAnimationFrame(() => {
      if (textareaRef.current) textareaRef.current.style.height = 'auto'
    })
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  function handleInput(e: ChangeEvent<HTMLTextAreaElement>) {
    setValue(e.target.value)
    const el = e.target
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`
  }

  return (
    <div className="border-t border-base-800 p-4">
      <div className="flex items-end gap-2 rounded-2xl border border-base-700 bg-base-900 p-2 pl-4 focus-within:border-accent-500/60">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          rows={1}
          placeholder={disabled ? 'Claude is working…' : 'Describe a task for Claude Code…'}
          className="max-h-48 flex-1 resize-none bg-transparent py-2 text-sm text-base-100 outline-none placeholder:text-base-500 disabled:opacity-50"
        />
        <button
          onClick={submit}
          disabled={disabled || !value.trim()}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-600 text-white transition hover:bg-accent-500 disabled:cursor-not-allowed disabled:opacity-30"
        >
          <ArrowUp size={16} />
        </button>
      </div>
      <p className="mt-1.5 px-1 text-[11px] text-base-600">Enter to send · Shift+Enter for a new line</p>
    </div>
  )
}
