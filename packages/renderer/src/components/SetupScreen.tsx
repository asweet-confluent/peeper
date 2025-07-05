import React, { useState } from 'react'

interface SetupScreenProps {
  onTokenSaved: () => void
}

const SetupScreen: React.FC<SetupScreenProps> = ({ onTokenSaved }) => {
  const [token, setToken] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!token.trim()) {
      setError('Please enter a token')
      return
    }

    setIsLoading(true)
    setError('')
    setSuccess('')

    try {
      // Test the token first
      const testResult = await window.api.invoke.testToken(token)
      if (!testResult.success) {
        setError(`Invalid token: ${testResult.error}`)
        return
      }

      // Save the token
      await window.api.invoke.saveToken(token)
      setSuccess('Token saved successfully!')

      setTimeout(() => {
        onTokenSaved()
      }, 1000)
    }
    catch (error) {
      setError(`Error: ${(error as Error).message}`)
    }
    finally {
      setIsLoading(false)
    }
  }

  const handleHelpClick = () => {
    window.api.invoke.openExternal('https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token')
  }

  return (
    <div className="setup-screen">
      <div className="setup-card">
        <h1>Peeper</h1>
        <p>
          To get started, you'll need a GitHub personal access token with
          the
          {' '}
          <code>notifications</code>
          {' '}
          scope.
        </p>

        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <label htmlFor="github-token">Personal Access Token:</label>
            <input
              type="password"
              id="github-token"
              value={token}
              onChange={e => setToken(e.target.value)}
              placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
              disabled={isLoading}
            />
          </div>

          {error && <div className="error" style={{ display: 'block' }}>{error}</div>}
          {success && <div className="success" style={{ display: 'block' }}>{success}</div>}

          <button type="submit" className="btn primary" disabled={isLoading}>
            {isLoading ? 'Testing token...' : 'Save Token'}
          </button>
        </form>

        <p className="help-text">
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault()
              handleHelpClick()
            }}
          >
            How to create a personal access token
          </a>
        </p>
      </div>
    </div>
  )
}

export default SetupScreen
