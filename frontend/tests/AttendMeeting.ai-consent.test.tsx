import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

const apiMocks = vi.hoisted(() => ({
  generateMeetingMinutes: vi.fn(),
  transcribeMeetingAudio: vi.fn(),
}))

vi.mock('../src/api', () => ({
  ...apiMocks,
  getErrorMessage: (_error: unknown, fallback: string) => fallback,
}))

vi.mock('../src/autosave/useAutosaveDraft', () => ({
  useAutosaveDraft: vi.fn(),
}))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('AttendMeeting AI processing consent', () => {
  it('does not process audio until the user gives contextual consent', async () => {
    apiMocks.transcribeMeetingAudio.mockResolvedValue({ transcript: 'Meeting transcript' })
    apiMocks.generateMeetingMinutes.mockResolvedValue({ summary: 'Meeting summary' })
    const { default: AttendMeeting } = await import('../src/pages/ai/AttendMeeting')

    render(<MemoryRouter><AttendMeeting /></MemoryRouter>)

    const fileInput = screen.getByLabelText('Upload Recording')
    fireEvent.change(fileInput, {
      target: { files: [new File(['audio'], 'meeting.webm', { type: 'audio/webm' })] },
    })

    const generateButton = screen.getByRole('button', { name: 'Generate Minutes' })
    expect((generateButton as HTMLButtonElement).disabled).toBe(true)
    expect(apiMocks.transcribeMeetingAudio).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('checkbox'))
    expect((generateButton as HTMLButtonElement).disabled).toBe(false)
    fireEvent.click(generateButton)

    await waitFor(() => expect(apiMocks.transcribeMeetingAudio).toHaveBeenCalledWith(
      expect.any(File),
      '2026-09-13',
    ))
    expect(apiMocks.generateMeetingMinutes).toHaveBeenCalledWith(expect.objectContaining({
      consentVersion: '2026-09-13',
    }))

    fireEvent.change(fileInput, {
      target: { files: [new File(['new audio'], 'replacement.webm', { type: 'audio/webm' })] },
    })
    expect((screen.getByRole('checkbox') as HTMLInputElement).checked).toBe(false)
    expect((generateButton as HTMLButtonElement).disabled).toBe(true)
  })
})