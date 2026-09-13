import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

import MeetingRecorder from '../src/components/ai/MeetingRecorder'

vi.mock('../src/api', () => ({
  getApiBaseUrl: () => 'https://api.example.test',
  getAuthToken: () => 'token',
}))

class FakeMediaRecorder {
  ondataavailable: ((event: { data: Blob }) => void) | null = null
  onstop: (() => void | Promise<void>) | null = null
  stream: MediaStream

  constructor(stream: MediaStream) {
    this.stream = stream
  }

  start() {}

  stop() {
    this.ondataavailable?.({ data: new Blob(['audio'], { type: 'audio/webm' }) })
    void this.onstop?.()
  }
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('MeetingRecorder AI processing consent', () => {
  it('requires consent and includes its proof in the transcription request', async () => {
    const stopTrack = vi.fn()
    const stream = { getTracks: () => [{ stop: stopTrack }] } as unknown as MediaStream
    const getUserMedia = vi.fn().mockResolvedValue(stream)
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia },
    })
    vi.stubGlobal('MediaRecorder', FakeMediaRecorder)
    const fetchMock = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchMock)

    render(<MemoryRouter><MeetingRecorder /></MemoryRouter>)

    const startButton = screen.getByRole('button', { name: 'Start Recording' })
    expect((startButton as HTMLButtonElement).disabled).toBe(true)
    expect(getUserMedia).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(startButton)
    await screen.findByRole('button', { name: 'Stop Recording' })

    fireEvent.click(screen.getByRole('button', { name: 'Stop Recording' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce())
    const request = fetchMock.mock.calls[0][1] as RequestInit
    const body = request.body as FormData
    expect(body.get('ai_processing_consent')).toBe('true')
    expect(body.get('consent_version')).toBe('2026-09-13')
    expect(body.get('audio')).toBeInstanceOf(Blob)
    await waitFor(() => expect(stopTrack).toHaveBeenCalledOnce())
    expect((screen.getByRole('checkbox') as HTMLInputElement).checked).toBe(false)
  })
})
