import React, { useState, useEffect, useRef } from 'react'
import type { QuickFilterConfig } from '../../../preload/src/types.js'

interface QuickFiltersDropdownProps {
  inboxId: number | undefined
  onConfigChange: () => void
}

const QuickFiltersDropdown: React.FC<QuickFiltersDropdownProps> = ({ inboxId, onConfigChange }) => {
  const [isOpen, setIsOpen] = useState(false)
  const [config, setConfig] = useState<QuickFilterConfig | null>(null)
  const [loading, setLoading] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (inboxId) {
      loadQuickFilterConfig()
    } else {
      setConfig(null)
    }
  }, [inboxId])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const loadQuickFilterConfig = async () => {
    if (!inboxId) return
    
    try {
      setLoading(true)
      const result = await window.api.invoke.getQuickFilterConfig(inboxId)
      setConfig(result)
    } catch (error) {
      console.error('Error loading quick filter config:', error)
    } finally {
      setLoading(false)
    }
  }

  const updateConfig = async (updates: Partial<QuickFilterConfig>) => {
    if (!inboxId || !config) return

    try {
      setLoading(true)
      const newConfig = { ...config, ...updates }
      setConfig(newConfig)
      
      // Convert boolean values to numbers for SQLite
      const sqliteConfig = {
        hide_read: typeof newConfig.hide_read === 'boolean' ? (newConfig.hide_read ? 1 : 0) : newConfig.hide_read,
        hide_merged_prs: typeof newConfig.hide_merged_prs === 'boolean' ? (newConfig.hide_merged_prs ? 1 : 0) : newConfig.hide_merged_prs,
        hide_drafts: typeof newConfig.hide_drafts === 'boolean' ? (newConfig.hide_drafts ? 1 : 0) : newConfig.hide_drafts,
        hide_done: typeof newConfig.hide_done === 'boolean' ? (newConfig.hide_done ? 1 : 0) : newConfig.hide_done,
      }
      
      await window.api.invoke.updateQuickFilterConfig(inboxId, sqliteConfig)
      onConfigChange()
    } catch (error) {
      console.error('Error updating quick filter config:', error)
    } finally {
      setLoading(false)
    }
  }

  const toggleHideRead = () => {
    const newValue = !getBooleanValue(config?.hide_read)
    updateConfig({ hide_read: newValue })
  }

  const toggleHideMergedPRs = () => {
    const newValue = !getBooleanValue(config?.hide_merged_prs)
    updateConfig({ hide_merged_prs: newValue })
  }

  const toggleHideDrafts = () => {
    const newValue = !getBooleanValue(config?.hide_drafts)
    updateConfig({ hide_drafts: newValue })
  }

  const toggleHideDone = () => {
    const newValue = !getBooleanValue(config?.hide_done)
    updateConfig({ hide_done: newValue })
  }

  const getBooleanValue = (value: boolean | number | undefined): boolean => {
    if (typeof value === 'boolean') return value
    if (typeof value === 'number') return value === 1
    return false
  }

  if (!inboxId) {
    return null // Don't show quick filters for "All Notifications"
  }

  return (
    <div className="quick-filters-dropdown" ref={dropdownRef}>
      <button
        className="quick-filters-button"
        onClick={() => setIsOpen(!isOpen)}
        disabled={loading}
        title="Quick Filters"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path d="M6 10.5a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 0 1h-3a.5.5 0 0 1-.5-.5zm-2-3a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 0 1h-7a.5.5 0 0 1-.5-.5zm-2-3a.5.5 0 0 1 .5-.5h11a.5.5 0 0 1 0 1h-11a.5.5 0 0 1-.5-.5z"/>
        </svg>
        Quick Filters
        <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" style={{ marginLeft: '4px' }}>
          <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1" fill="none"/>
        </svg>
      </button>

      {isOpen && config && (
        <div className="quick-filters-menu">
          <div className="quick-filters-header">Quick Filters</div>
          
          <label className="quick-filter-option">
            <input
              type="checkbox"
              checked={getBooleanValue(config.hide_read)}
              onChange={toggleHideRead}
              disabled={loading}
            />
            <span className="checkmark"></span>
            Hide read notifications
          </label>

          <label className="quick-filter-option">
            <input
              type="checkbox"
              checked={getBooleanValue(config.hide_merged_prs)}
              onChange={toggleHideMergedPRs}
              disabled={loading}
            />
            <span className="checkmark"></span>
            Hide merged PRs
          </label>

          <label className="quick-filter-option">
            <input
              type="checkbox"
              checked={getBooleanValue(config.hide_drafts)}
              onChange={toggleHideDrafts}
              disabled={loading}
            />
            <span className="checkmark"></span>
            Hide drafts
          </label>

          <label className="quick-filter-option">
            <input
              type="checkbox"
              checked={getBooleanValue(config.hide_done)}
              onChange={toggleHideDone}
              disabled={loading}
            />
            <span className="checkmark"></span>
            Hide done items
          </label>
        </div>
      )}
    </div>
  )
}

export default QuickFiltersDropdown
