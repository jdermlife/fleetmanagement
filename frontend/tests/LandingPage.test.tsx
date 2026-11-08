import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import LandingPage from '../src/pages/public/LandingPage'

describe('LandingPage', () => {
  it('presents public product value and trial actions', () => {
    render(<MemoryRouter><LandingPage /></MemoryRouter>)

    expect(screen.getByRole('heading', {
      name: 'FILSCORE ai - Your Financial Health Dashboard',
    })).toBeTruthy()
    expect(screen.getByRole('img', {
      name: 'FILSCORE financial health dashboard displayed on a phone',
    })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Financial Health Dashboard' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'AI Financial Assistant' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Explore FILSCORE with a 2-day free trial.' })).toBeTruthy()
    expect(screen.getByRole('link', { name: /start free trial/i }).getAttribute('href')).toBe('/register')
    const dashboardPreview = screen.getByLabelText('FILSCORE dashboard preview')
    const exploreTools = screen.getByRole('link', { name: 'Explore the tools' })
    expect(dashboardPreview.compareDocumentPosition(exploreTools) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'About Quantech International' })).toBeTruthy()
  })
})