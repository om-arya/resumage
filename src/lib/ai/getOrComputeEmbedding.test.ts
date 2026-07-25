import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getOrComputeEmbedding } from './getOrComputeEmbedding'
import { getCachedEmbedding, setCachedEmbedding } from './embeddingCache'
import { embedText } from './embeddingWorkerClient'

vi.mock('./embeddingCache', () => ({
  getCachedEmbedding: vi.fn(),
  setCachedEmbedding: vi.fn(),
}))
vi.mock('./embeddingWorkerClient', () => ({ embedText: vi.fn() }))

const mockedGetCached = vi.mocked(getCachedEmbedding)
const mockedSetCached = vi.mocked(setCachedEmbedding)
const mockedEmbedText = vi.mocked(embedText)

describe('getOrComputeEmbedding', () => {
  beforeEach(() => {
    mockedGetCached.mockReset()
    mockedSetCached.mockReset().mockResolvedValue(undefined)
    mockedEmbedText.mockReset()
  })

  it('returns the cached embedding without invoking the worker', async () => {
    mockedGetCached.mockResolvedValue([0.1, 0.2])

    const result = await getOrComputeEmbedding('key-1', 'some text')

    expect(result).toEqual([0.1, 0.2])
    expect(mockedEmbedText).not.toHaveBeenCalled()
  })

  it('computes via the worker and caches it on a cache miss', async () => {
    mockedGetCached.mockResolvedValue(undefined)
    mockedEmbedText.mockResolvedValue([0.3, 0.4])

    const result = await getOrComputeEmbedding('key-2', 'other text')

    expect(mockedEmbedText).toHaveBeenCalledWith('other text')
    expect(mockedSetCached).toHaveBeenCalledWith('key-2', [0.3, 0.4])
    expect(result).toEqual([0.3, 0.4])
  })
})
