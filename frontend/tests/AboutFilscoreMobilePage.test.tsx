import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import AboutFilscoreMobilePage, {
  ABOUT_FILSCORE_MOBILE_CONTENT,
} from '../src/pages/admin/AboutFilscoreMobilePage'

afterEach(cleanup)

describe('AboutFilscoreMobilePage', () => {
  it('publishes the requested title and exactly 600 words', () => {
    render(<AboutFilscoreMobilePage />)

    expect(screen.getByRole('heading', { name: 'About FILSCORE for Apple and Android' })).toBeTruthy()
    expect(ABOUT_FILSCORE_MOBILE_CONTENT.match(/\b[\w]+(?:['’-][\w]+)*\b/g)).toHaveLength(600)
  })
})