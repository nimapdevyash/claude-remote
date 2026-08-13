import { useRef, useState, type ChangeEvent, type ClipboardEvent, type DragEvent, type KeyboardEvent } from 'react'
import { ArrowUp, Paperclip } from 'lucide-react'
import { api } from '../lib/api'

type Props = {
  disabled: boolean
  sessionId: string
  onSend: (prompt: string) => void
}

export function Composer({ disabled, sessionId, onSend }: Props) {
  const [value, setValue] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  function resize() {
    requestAnimationFrame(() => {
      if (textareaRef.current) textareaRef.current.style.height = 'auto'
    })
  }

  function submit() {
    const trimmed = value.trim()
    if (!trimmed || disabled) return
    onSend(trimmed)
    setValue('')
    resize()
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

  // Inserts text at the current caret position rather than always at the
  // end, so an attachment placeholder lands where the user was typing —
  // the same feel as dropping a file into a terminal at the cursor.
  function insertAtCursor(text: string) {
    const el = textareaRef.current
    const start = el?.selectionStart ?? value.length
    const end = el?.selectionEnd ?? value.length
    setValue((v) => `${v.slice(0, start)}${text}${v.slice(end)}`)
    requestAnimationFrame(() => {
      if (!el) return
      const caret = start + text.length
      el.focus()
      el.setSelectionRange(caret, caret)
    })
  }

  // Placeholder text carries a random token so it stays a unique substring
  // to search-and-replace later, even if the same filename is attached
  // twice (e.g. two screenshots both named "image.png").
  async function attachFile(file: File) {
    const token = Math.random().toString(36).slice(2, 8)
    const placeholder = `[Uploading ${file.name} (${token})…]`
    insertAtCursor(placeholder)
    try {
      const { path } = await api.uploadFile(sessionId, file)
      setValue((v) => v.replace(placeholder, path))
    } catch (e) {
      const message = e instanceof Error ? e.message : 'upload failed'
      setValue((v) => v.replace(placeholder, `[Upload failed: ${file.name} — ${message}]`))
    }
  }

  function attachFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    Array.from(files).forEach(attachFile)
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setIsDragging(false)
    attachFiles(e.dataTransfer.files)
  }

  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setIsDragging(true)
  }

  function handleDragLeave(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setIsDragging(false)
  }

  function handlePaste(e: ClipboardEvent<HTMLTextAreaElement>) {
    const files = e.clipboardData?.files
    if (files && files.length > 0) {
      e.preventDefault()
      attachFiles(files)
    }
  }

  function handleFilePick(e: ChangeEvent<HTMLInputElement>) {
    attachFiles(e.target.files)
    e.target.value = ''
  }

  return (
    <div className="border-t border-base-800 p-4">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`flex items-end gap-2 rounded-2xl border bg-base-900 p-2 pl-4 transition focus-within:border-accent-500/60 ${
          isDragging ? 'border-accent-500 bg-accent-500/5' : 'border-base-700'
        }`}
      >
        <label className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-xl text-base-400 transition hover:bg-base-800 hover:text-base-200">
          <Paperclip size={16} />
          <input type="file" multiple className="hidden" onChange={handleFilePick} />
        </label>
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          disabled={disabled}
          rows={1}
          placeholder={disabled ? 'Claude is working…' : 'Describe a task for Claude Code… (drag & drop or paste files)'}
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
      <p className="mt-1.5 px-1 text-[11px] text-base-600">
        Enter to send · Shift+Enter for a new line · drag, paste, or click <Paperclip size={10} className="inline" /> to attach a file
      </p>
    </div>
  )
}
