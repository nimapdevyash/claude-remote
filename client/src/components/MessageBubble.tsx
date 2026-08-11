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
  return (
    <div className="max-w-2xl rounded-2xl rounded-tl-sm border border-base-800 bg-base-900 px-4 py-3 text-sm text-base-100">
      <div className="prose-chat">
        <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
          {text}
        </ReactMarkdown>
      </div>
    </div>
  )
}
