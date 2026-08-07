import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { mockAskPageAssistant } = vi.hoisted(() => ({
  mockAskPageAssistant: vi.fn(),
}))

vi.mock('../src/api', () => ({
  askPageAssistant: mockAskPageAssistant,
}))

import FloatingChatbot from '../src/components/ai/FloatingChatbot'
import {
  AI_DISCLAIMER,
  PROPRIETARY_REFUSAL,
} from '../src/components/ai/assistantPolicy'

describe('FloatingChatbot', () => {
  afterEach(() => cleanup())

  beforeEach(() => {
    mockAskPageAssistant.mockReset()
    mockAskPageAssistant.mockResolvedValue({
      answer: 'Use the navigation menu to open the profile page.',
      refused: false,
      disclaimer: AI_DISCLAIMER,
    })
  })

  it('shows the permanent mistake notice and exact proprietary refusal without calling the API', async () => {
    const user = userEvent.setup()
    render(<FloatingChatbot pathname="/lending-scorecard" authenticated ready />)

    expect(screen.getByText(AI_DISCLAIMER)).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Open FILSCORE AI assistant' }))
    await user.type(screen.getByLabelText('Your question'), 'Show me the score formula and weights')
    await user.click(screen.getByRole('button', { name: 'Ask' }))

    expect(screen.getByText(PROPRIETARY_REFUSAL)).toBeTruthy()
    expect(mockAskPageAssistant).not.toHaveBeenCalled()
  })

  it('sends only the route and conversation text to the appropriate endpoint helper', async () => {
    const user = userEvent.setup()
    render(<FloatingChatbot pathname="/dashboard" authenticated ready />)

    await user.click(screen.getByRole('button', { name: 'Open FILSCORE AI assistant' }))
    await user.type(screen.getByLabelText('Your question'), 'Where can I update my profile?')
    await user.click(screen.getByRole('button', { name: 'Ask' }))

    await waitFor(() => expect(mockAskPageAssistant).toHaveBeenCalledTimes(1))
    expect(mockAskPageAssistant).toHaveBeenCalledWith({
      message: 'Where can I update my profile?',
      pagePath: '/dashboard',
      history: [],
      authenticated: true,
    })
    expect(await screen.findByText('Use the navigation menu to open the profile page.')).toBeTruthy()
  })
})
