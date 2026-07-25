import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computeSemanticFields } from './computeSemanticFields'
import { hashText } from './hashText'
import { getOrComputeEmbedding } from '../ai/getOrComputeEmbedding'

vi.mock('../ai/getOrComputeEmbedding', () => ({ getOrComputeEmbedding: vi.fn() }))

const mockedGetOrComputeEmbedding = vi.mocked(getOrComputeEmbedding)

describe('computeSemanticFields', () => {
  beforeEach(() => {
    mockedGetOrComputeEmbedding.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('reuses the existing embedding when the hash is unchanged', async () => {
    const text = 'Software Engineer at Acme.'
    const hash = hashText(text)
    const existingEmbedding = [0.1, 0.2, 0.3]

    const result = await computeSemanticFields({
      uid: 'user-1',
      semanticText: text,
      existingSemanticTextHash: hash,
      existingEmbedding,
    })

    expect(result).toEqual({ semanticText: text, semanticTextHash: hash, embedding: existingEmbedding })
    expect(mockedGetOrComputeEmbedding).not.toHaveBeenCalled()
  })

  it('recomputes when the hash changed, using a content-addressed cache key', async () => {
    const text = 'Updated text'
    const hash = hashText(text)
    mockedGetOrComputeEmbedding.mockResolvedValue([0.4, 0.5])

    const result = await computeSemanticFields({
      uid: 'user-1',
      semanticText: text,
      existingSemanticTextHash: 'stale-hash',
      existingEmbedding: [0.1, 0.2],
    })

    expect(mockedGetOrComputeEmbedding).toHaveBeenCalledWith(`user-1:${hash}`, text)
    expect(result).toEqual({ semanticText: text, semanticTextHash: hash, embedding: [0.4, 0.5] })
  })

  it('recomputes when there is no existing embedding, even if the hash matches', async () => {
    const text = 'Some text'
    const hash = hashText(text)
    mockedGetOrComputeEmbedding.mockResolvedValue([0.9])

    const result = await computeSemanticFields({
      uid: 'user-1',
      semanticText: text,
      existingSemanticTextHash: hash,
      existingEmbedding: null,
    })

    expect(mockedGetOrComputeEmbedding).toHaveBeenCalledWith(`user-1:${hash}`, text)
    expect(result.embedding).toEqual([0.9])
  })

  it('falls back to a null embedding (never throws) when computation fails', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const text = 'Some text'
    const hash = hashText(text)
    mockedGetOrComputeEmbedding.mockRejectedValue(new Error('worker unavailable'))

    const result = await computeSemanticFields({
      uid: 'user-1',
      semanticText: text,
      existingSemanticTextHash: 'stale-hash',
      existingEmbedding: [0.1, 0.2],
    })

    expect(result).toEqual({ semanticText: text, semanticTextHash: hash, embedding: null })
    expect(warnSpy).toHaveBeenCalled()
  })
})
