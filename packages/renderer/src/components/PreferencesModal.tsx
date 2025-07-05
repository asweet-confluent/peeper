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

  const loadPreferences = async () => {
    try {
      const prefs = await window.api.invoke.getPreferences()
      setPreferences(prefs)
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
      onClose()
    }
    catch (error) {
      console.error('Error saving preferences:', error)
    }
    finally {
      setSaving(false)
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
            <h3>About</h3>
            <div className="preference-item">
              <p className="preference-description">
                Peeper - GitHub Notifications Desktop App
                <br />
                Version 1.0.0
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
