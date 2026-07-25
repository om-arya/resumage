interface EmbedResultMessage {
  id: number
  type: 'embed-result'
  embedding: number[]
}

interface EmbedErrorMessage {
  id: number
  type: 'embed-error'
  error: string
}

interface PendingRequest {
  resolve: (embedding: number[]) => void
  reject: (error: Error) => void
}

let worker: Worker | null = null
let nextRequestId = 0
const pendingRequests = new Map<number, PendingRequest>()

function getWorker(): Worker {
  if (worker) return worker

  worker = new Worker(new URL('../../workers/embedding.worker.ts', import.meta.url), { type: 'module' })
  worker.onmessage = (event: MessageEvent<EmbedResultMessage | EmbedErrorMessage>) => {
    const message = event.data
    const request = pendingRequests.get(message.id)
    if (!request) return
    pendingRequests.delete(message.id)
    if (message.type === 'embed-result') request.resolve(message.embedding)
    else request.reject(new Error(message.error))
  }
  return worker
}

/** Runs `Xenova/all-MiniLM-L6-v2` feature extraction for `text` inside a dedicated Web Worker. */
export function embedText(text: string): Promise<number[]> {
  const activeWorker = getWorker()
  const id = nextRequestId++
  return new Promise((resolve, reject) => {
    pendingRequests.set(id, { resolve, reject })
    activeWorker.postMessage({ id, type: 'embed', text })
  })
}
