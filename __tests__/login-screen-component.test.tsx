import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import LoginScreen from '@/components/shared/LoginScreen'

describe('LoginScreen', () => {
  afterEach(cleanup)
  it('renders sign-in form elements', () => {
    render(<LoginScreen onSignIn={async () => {}} />)
    expect(screen.getByPlaceholderText('Email')).toBeDefined()
    expect(screen.getByPlaceholderText('Password')).toBeDefined()
    expect(screen.getByText('Sign In')).toBeDefined()
  })

  it('renders title', () => {
    render(<LoginScreen onSignIn={async () => {}} />)
    expect(screen.getByText('Tristar PT — Sign In')).toBeDefined()
  })

  it('shows error message on failed sign-in', async () => {
    const failingSignIn = async () => { throw new Error('Invalid credentials') }
    render(<LoginScreen onSignIn={failingSignIn} />)

    const emailInput = screen.getByPlaceholderText('Email')
    const passwordInput = screen.getByPlaceholderText('Password')
    const submitBtn = screen.getByText('Sign In')

    fireEvent.change(emailInput, { target: { value: 'test@test.com' } })
    fireEvent.change(passwordInput, { target: { value: 'wrong' } })
    fireEvent.click(submitBtn)

    const errorMsg = await screen.findByText('Invalid credentials')
    expect(errorMsg).toBeDefined()
  })

  it('disables button while submitting', async () => {
    let resolveSignIn: () => void
    const slowSignIn = () => new Promise<void>((resolve) => { resolveSignIn = resolve })
    render(<LoginScreen onSignIn={slowSignIn} />)

    fireEvent.change(screen.getByPlaceholderText('Email'), { target: { value: 'a@b.com' } })
    fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: 'pass' } })
    fireEvent.click(screen.getByText('Sign In'))

    expect(await screen.findByText('Signing in...')).toBeDefined()
    resolveSignIn!()
  })
})
