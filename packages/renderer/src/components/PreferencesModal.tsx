import type { Preferences } from '../../../preload/src/types.js'
import React, { useEffect, useState } from 'react'

interface PreferencesModalProps {
  onClose: () => void
}

const PreferencesModal: React.FC<PreferencesModalProps> = ({
  onClose,
}) => {
  const [preferences, setPreferences] = useState<Preferences>({
    autoSyncEnabled: true,
    autoSyncIntervalSeconds: 300000, // 5 minutes
    showDesktopNotifications: true,
    soundEnabled: true,
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [githubToken, setGithubToken] = useState('')
  const [hasExistingToken, setHasExistingToken] = useState(false)
  const [showToken, setShowToken] = useState(false)
  const [testingToken, setTestingToken] = useState(false)
  const [tokenTestResult, setTokenTestResult] = useState<{ success?: boolean; error?: string } | null>(null)

  const loadPreferences = async () => {
    try {
      const prefs = await window.api.invoke.getPreferences()
      setPreferences(prefs)

      // Check if user has an existing token
      const existingToken = await window.api.invoke.getToken()
      setHasExistingToken(!!existingToken)
    }
    catch (error) {
      console.error('Error loading preferences:', error)
    }
    finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPreferences()
  }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      await window.api.invoke.savePreferences(preferences)
      
      // Save GitHub token if one was entered
      if (githubToken.trim()) {
        await window.api.invoke.saveToken(githubToken.trim())
      }
      
      onClose()
    }
    catch (error) {
      console.error('Error saving preferences:', error)
    }
    finally {
      setSaving(false)
    }
  }

  const handleTestToken = async () => {
    if (!githubToken.trim()) {
      setTokenTestResult({ error: 'Please enter a token to test' })
      return
    }

    setTestingToken(true)
    setTokenTestResult(null)
    
    try {
      const result = await window.api.invoke.testToken(githubToken.trim())
      if (result.success) {
        setTokenTestResult({ success: true })
      } else {
        setTokenTestResult({ error: result.error || 'Token validation failed' })
      }
    } catch (error) {
      setTokenTestResult({ error: error instanceof Error ? error.message : 'Failed to test token' })
    } finally {
      setTestingToken(false)
    }
  }

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  const intervalOptions = [
    { value: 60, label: '1 minute' },
    { value: 300, label: '5 minutes' },
    { value: 600, label: '10 minutes' },
    { value: 900, label: '15 minutes' },
    { value: 1800, label: '30 minutes' },
    { value: 3600, label: '1 hour' },
  ]

  if (loading) {
    return (
      <div className="modal-backdrop">
        <div className="modal-content preferences-modal">
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Loading preferences...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="modal-backdrop" onClick={handleBackdropClick}>
      <div className="modal-content preferences-modal">
        <div className="modal-header">
          <h2>Preferences</h2>
          <button
            className="modal-close"
            onClick={onClose}
            type="button"
          >
            ✕
          </button>
        </div>

        <div className="modal-body">
          <div className="preference-section">
            <h3>Synchronization</h3>

            <div className="preference-item">
              <label className="preference-label">
                <input
                  type="checkbox"
                  checked={preferences.autoSyncEnabled}
                  onChange={e => setPreferences({
                    ...preferences,
                    autoSyncEnabled: e.target.checked,
                  })}
                />
                <span>Enable automatic synchronization</span>
              </label>
              <p className="preference-description">
                Automatically fetch new notifications in the background
              </p>
            </div>

            {preferences.autoSyncEnabled && (
              <div className="preference-item">
                <label className="preference-label">
                  <span>Sync interval</span>
                </label>
                <select
                  value={preferences.autoSyncIntervalSeconds}
                  onChange={e => setPreferences({
                    ...preferences,
                    autoSyncIntervalSeconds: Number.parseInt(e.target.value),
                  })}
                  className="preference-select"
                >
                  {intervalOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <p className="preference-description">
                  How often to check for new notifications
                </p>
              </div>
            )}
          </div>

          <div className="preference-section">
            <h3>Notifications</h3>

            <div className="preference-item">
              <label className="preference-label">
                <input
                  type="checkbox"
                  checked={preferences.showDesktopNotifications}
                  onChange={e => setPreferences({
                    ...preferences,
                    showDesktopNotifications: e.target.checked,
                  })}
                />
                <span>Show desktop notifications</span>
              </label>
              <p className="preference-description">
                Display system notifications when new GitHub notifications arrive
              </p>
            </div>

            <div className="preference-item">
              <label className="preference-label">
                <input
                  type="checkbox"
                  checked={preferences.soundEnabled}
                  onChange={e => setPreferences({
                    ...preferences,
                    soundEnabled: e.target.checked,
                  })}
                />
                <span>Enable notification sounds</span>
              </label>
              <p className="preference-description">
                Play a sound when new notifications arrive
              </p>
            </div>
          </div>

          <div className="preference-section">
            <h3>GitHub Authentication</h3>
            
            <div className="preference-item">
              <label className="preference-label">
                <span>GitHub Personal Access Token</span>
              </label>
              
              {hasExistingToken && !githubToken && (
                <div className="existing-token-info">
                  <p className="preference-description">
                    ✓ You currently have a token configured.
                  </p>
                  <button
                    type="button"
                    className="btn btn-secondary btn-small"
                    onClick={() => setShowToken(true)}
                  >
                    Change Token
                  </button>
                </div>
              )}
              
              {(!hasExistingToken || showToken || githubToken) && (
                <div className="token-input-section">
                  <div className="token-input-container">
                    <input
                      type="password"
                      value={githubToken}
                      onChange={(e) => {
                        setGithubToken(e.target.value)
                        setTokenTestResult(null) // Clear previous test results
                      }}
                      placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                      className="preference-input"
                    />
                    <button
                      type="button"
                      className="btn btn-secondary btn-small"
                      onClick={handleTestToken}
                      disabled={testingToken || !githubToken.trim()}
                    >
                      {testingToken ? 'Testing...' : 'Test Token'}
                    </button>
                  </div>
                  
                  {tokenTestResult && (
                    <div className={`token-test-result ${tokenTestResult.success ? 'success' : 'error'}`}>
                      {tokenTestResult.success 
                        ? '✓ Token is valid and working!' 
                        : `✗ ${tokenTestResult.error}`
                      }
                    </div>
                  )}
                  
                  <p className="preference-description">
                    Create a personal access token at{' '}
                    <a 
                      href="#" 
                      onClick={(e) => {
                        e.preventDefault()
                        window.api.invoke.openExternal('https://github.com/settings/tokens?scopes=notifications&description=GitHub%20Notifications%20App')
                      }}
                    >
                      github.com/settings/tokens
                    </a>
                    {' '}with the "notifications" scope.
                  </p>
                  
                  {hasExistingToken && (
                    <button
                      type="button"
                      className="btn btn-secondary btn-small"
                      onClick={() => {
                        setShowToken(false)
                        setGithubToken('')
                        setTokenTestResult(null)
                      }}
                    >
                      Cancel
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="preference-section">
            <h3>About</h3>
            <div className="preference-item">
              <p className="preference-description">
                Peeper - GitHub Notifications Desktop App
                <br />
                Version 1.0.1
                <br />
                Built with Electron and React
              </p>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default PreferencesModal
