import { env, pipeline, type FeatureExtractionPipeline } from '@xenova/transformers'

// Force remote-only model loading. Without this, transformers.js first probes
// a *local* path (e.g. /models/Xenova/all-MiniLM-L6-v2/config.json) that
// doesn't exist on our server; Vite's dev-server SPA fallback then returns
// index.html for that 404, and the library's JSON.parse of that HTML is what
// surfaces as "Unexpected token '<' ... is not valid JSON".
env.allowLocalModels = false

interface EmbedRequest {
  id: number
  type: 'embed'
  text: string
}

interface EmbedResultResponse {
  id: number
  type: 'embed-result'
  embedding: number[]
}

interface EmbedErrorResponse {
  id: number
  type: 'embed-error'
  error: string
}

// `self` is typed as `Window` under this project's DOM-only lib config; cast to
// the minimal worker-global shape we actually use rather than pulling in the
// (conflicting) "webworker" lib alongside "DOM".
const ctx = self as unknown as {
  onmessage: ((event: MessageEvent<EmbedRequest>) => void) | null
  postMessage: (message: EmbedResultResponse | EmbedErrorResponse) => void
}

let extractorPromise: Promise<FeatureExtractionPipeline> | null = null

function getExtractor(): Promise<FeatureExtractionPipeline> {
  extractorPromise ??= pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2')
  return extractorPromise
}

ctx.onmessage = async (event) => {
  const { id, text } = event.data
  try {
    const extractor = await getExtractor()
    const output = await extractor(text, { pooling: 'mean', normalize: true })
    const embedding = Array.from(output.data as ArrayLike<number>)
    ctx.postMessage({ id, type: 'embed-result', embedding })
  } catch (err) {
    ctx.postMessage({
      id,
      type: 'embed-error',
      error: err instanceof Error ? err.message : 'Embedding failed',
    })
  }
}
