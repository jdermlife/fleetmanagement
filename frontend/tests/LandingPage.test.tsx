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
    const categories = screen.getByLabelText('Financial health categories')
    expect(categories.textContent).toContain('Cash and Credit')
    expect(categories.textContent).toContain('Protection & Budget')
    expect(categories.textContent).toContain('Investment & Retirement Goals')
    expect(categories.textContent).not.toContain('Gold')
    expect(categories.textContent).not.toContain('Silver')
    expect(categories.textContent).not.toContain('Bronze')
    expect(screen.getByRole('heading', { name: 'Financial Health Dashboard' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'AI Financial Assistant' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Explore FILSCORE with a 2-day free trial.' })).toBeTruthy()
    expect(screen.getByRole('link', { name: /start free trial/i }).getAttribute('href')).toBe('/register')
    expect(screen.getByRole('heading', { name: 'About Quantech International' })).toBeTruthy()
  })
})