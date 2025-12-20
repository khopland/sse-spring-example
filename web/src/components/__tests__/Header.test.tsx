import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'

// Mock @tanstack/react-router Link to render a simple anchor so tests can run without router context
vi.mock('@tanstack/react-router', () => {
  const React = require('react')
  return {
    Link: (props: any) => React.createElement('a', props),
  }
})

import Header from '../Header'

describe('Header', () => {
  test('toggles navigation when menu buttons are clicked', () => {
    const { container } = render(<Header />)
    const aside = container.querySelector('aside')
    expect(aside).toBeTruthy()

    // Initially closed
    expect(aside?.className).toContain('-translate-x-full')

    const openBtn = screen.getByRole('button', { name: /open menu/i })
    fireEvent.click(openBtn)
    expect(aside?.className).toContain('translate-x-0')

    const closeBtn = screen.getByRole('button', { name: /close menu/i })
    fireEvent.click(closeBtn)
    expect(aside?.className).toContain('-translate-x-full')
  })
})
