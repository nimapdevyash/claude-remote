import type { ClaudeEvent } from '../types/api'

export type ToolBlock = {
  kind: 'tool'
  id: string
  name: string
  input: any
  result: string | null
  isError: boolean
  pending: boolean
}
export type TextBlock = { kind: 'text'; id: string; text: string }
export type ErrorBlock = { kind: 'error'; id: string; text: string }
export type Block = ToolBlock | TextBlock | ErrorBlock

function stringifyToolResultContent(content: unknown): string {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content.map((c: any) => c?.text ?? JSON.stringify(c)).join('\n')
  }
  return JSON.stringify(content, null, 2)
}

// Flattens the raw stream-json events of a turn into an ordered list of
// renderable blocks, attaching each tool_result back onto its tool_use call.
export function deriveBlocks(events: ClaudeEvent[]): Block[] {
  const blocks: Block[] = []
  const toolIndexById = new Map<string, number>()

  events.forEach((event, eventIndex) => {
    if (event.type === 'assistant' && Array.isArray(event.message?.content)) {
      event.message.content.forEach((part: any, partIndex: number) => {
        if (part.type === 'text' && part.text) {
          blocks.push({ kind: 'text', id: `${eventIndex}-${partIndex}`, text: part.text })
        } else if (part.type === 'tool_use') {
          toolIndexById.set(part.id, blocks.length)
          blocks.push({
            kind: 'tool',
            id: part.id,
            name: part.name,
            input: part.input,
            result: null,
            isError: false,
            pending: true,
          })
        }
      })
    } else if (event.type === 'user' && Array.isArray(event.message?.content)) {
      for (const part of event.message.content) {
        if (part.type === 'tool_result') {
          const idx = toolIndexById.get(part.tool_use_id)
          if (idx !== undefined) {
            const existing = blocks[idx] as ToolBlock
            existing.pending = false
            existing.isError = Boolean(part.is_error)
            existing.result = stringifyToolResultContent(part.content)
          }
        }
      }
    } else if (event.type === 'raw_text') {
      blocks.push({ kind: 'error', id: `raw-${eventIndex}`, text: event.text })
    }
  })

  return blocks
}
