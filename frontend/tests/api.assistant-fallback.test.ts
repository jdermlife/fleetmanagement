import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  apiPost: vi.fn(),
  healthPost: vi.fn(),
}))

vi.mock('axios', () => {
  let createdClients = 0
  const createClient = (post: ReturnType<typeof vi.fn>) => ({
    get: vi.fn(),
    post,
    request: vi.fn(),
    defaults: { headers: { common: {} as Record<string, string> }, baseURL: '' },
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
  })
  const create = vi.fn(() => {
    createdClients += 1
    return createdClients === 1
      ? createClient(mocks.healthPost)
      : createClient(mocks.apiPost)
  })

  return {
    default: {
      create,
      isAxiosError: (error: unknown) => Boolean(
        error && typeof error === 'object' && 'isAxiosError' in error,
      ),
    },
    create,
  }
})

import {
  askPageAssistant,
  isOpenAiQuotaExhaustionResponse,
} from '../src/api'
import { DEFAULT_OLLAMA_FALLBACK_URL } from '../src/config'

const assistantPayload = {
  message: 'Where can I find customer service?',
  pagePath: '/login',
  history: [],
  authenticated: false,
}

describe('page assistant provider fallback', () => {
  beforeEach(() => {
    mocks.apiPost.mockReset()
    mocks.healthPost.mockReset()
  })

  it('recognizes only the explicit quota-exhaustion response code', () => {
    expect(isOpenAiQuotaExhaustionResponse({
      detail: { code: 'openai_quota_exhausted' },
    })).toBe(true)
    expect(isOpenAiQuotaExhaustionResponse({
      detail: { code: 'assistant_unavailable' },
    })).toBe(false)
  })

  it('uses the local Ollama endpoint after confirmed OpenAI quota exhaustion', async () => {
    mocks.apiPost.mockRejectedValue({
      isAxiosError: true,
      response: { data: { detail: { code: 'openai_quota_exhausted' } } },
    })
    mocks.healthPost.mockResolvedValue({
      data: {
        answer: 'Open Customer Service from the sign-in page.',
        refused: false,
        disclaimer: 'AI may commit mistakes.',
      },
    })

    const result = await askPageAssistant(assistantPayload)

    expect(result.answer).toContain('Customer Service')
    expect(mocks.healthPost).toHaveBeenCalledWith(
      DEFAULT_OLLAMA_FALLBACK_URL,
      {
        message: assistantPayload.message,
        page_path: assistantPayload.pagePath,
        history: [],
      },
      { timeout: 120000 },
    )
  })

  it('does not use Ollama for unrelated OpenAI or network failures', async () => {
    const originalError = {
      isAxiosError: true,
      response: { data: { detail: 'The assistant is temporarily unavailable.' } },
    }
    mocks.apiPost.mockRejectedValue(originalError)

    await expect(askPageAssistant(assistantPayload)).rejects.toBe(originalError)
    expect(mocks.healthPost).not.toHaveBeenCalled()
  })
})
