import type { Inbox } from '../../../preload/src/types.js'
import React, { forwardRef, useEffect, useRef, useState } from 'react'
import { usePeeperStore } from './store.js'
import ContextMenu from './ContextMenu.js'

const msInSecond = 1000
const msInMinute = 60 * msInSecond
const msInHour = 60 * msInMinute
const msInDay = 24 * msInHour

function calculateLastSyncDisplayText(lastSyncTime: Date | null) {
  if (!lastSyncTime) {
    return 'Never synced'
  }
  const now = new Date()
  const diffMs = now.getTime() - lastSyncTime?.getTime()

  let timeAgo = ''
  if (diffMs < msInSecond * 10) {
    timeAgo = 'Just now'
  }
  else if (diffMs < msInMinute) {
    timeAgo = '<1m ago'
  }
  else if (diffMs < msInHour) {
    const minutes = Math.floor(diffMs / msInMinute)
    timeAgo = `${minutes}m ago`
  }
  else if (diffMs < msInDay) { // Less than 1 day
    const hours = Math.floor(diffMs / msInHour)
    timeAgo = `${hours}h ago`
  }
  else {
    const days = Math.floor(diffMs / msInDay)
    timeAgo = `${days}d ago`
  }

  return `Last sync: ${timeAgo}`
}

interface SidebarProps {
  inboxes: Inbox[]
  currentInbox: Inbox | null
  lastSyncTime: Date | null
  onSelectInbox: (inbox: Inbox | null) => void
  onSyncButtonClick: () => void
  onCreateInbox: () => void
  onShowPreferences: () => void
  isSyncing?: boolean
}

const Sidebar: React.FC<SidebarProps> = ({
  inboxes,
  currentInbox,
  lastSyncTime,
  onSelectInbox,
  onSyncButtonClick,
  onCreateInbox,
  onShowPreferences,
  isSyncing = false,
}) => {
  const [lastSyncDisplayText, setLastSyncDisplayText] = React.useState<string>(calculateLastSyncDisplayText(lastSyncTime))
  const contextMenu = usePeeperStore.use.contextMenu()
  const enableContextMenu = usePeeperStore.use.enableContextMenu()
  const disableContextMenu = usePeeperStore.use.disableContextMenu()

  const contextMenuRef = useRef<HTMLDivElement>(null)

  const handleInboxClick = (inbox: Inbox) => {
    onSelectInbox(inbox)
  }

  const handleAllNotificationsClick = () => {
    onSelectInbox(null)
  }

  const handleInboxContextMenu = (e: React.MouseEvent, inbox: Inbox) => {
    e.preventDefault()
    e.stopPropagation()

    // const handleOutsideClick = (event: MouseEvent) => {
    //   console.log(`Target clicked: `)
    //   console.log(event.target)
    //   console.log(`Context menu ref: `)
    //   console.log(contextMenuRef.current)
    //   if (!contextMenuRef.current) {
    //     console.warn('Detected an outside click ')
    //   }
    //   if (contextMenuRef.current && !contextMenuRef.current.contains(event.target as Node)) {
    //     console.log('Click outside context menu, disabling it')
    //     disableContextMenu()
    //   } else {
    //     console.log('Click inside context menu, keeping it open')
    //   }
    // }

    // setTimeout(() => {
    //   document.addEventListener('click', handleOutsideClick)
    // }, 0)

    enableContextMenu(e.clientX, e.clientY, inbox)
  }

  useEffect(() => {
    // Update immediately when lastSyncTime changes
    setLastSyncDisplayText(calculateLastSyncDisplayText(lastSyncTime))

    const interval = setInterval(() => {
      const newLastSyncText = calculateLastSyncDisplayText(lastSyncTime)
      setLastSyncDisplayText(newLastSyncText)
    }, 10000)

    return () => {
      clearInterval(interval)
    }
  }, [lastSyncTime])

  return (
    <div className="sidebar">
      {contextMenu.visible && (
        <ContextMenu ref={contextMenuRef} />
      )}
      <div className="sidebar-header">
        <h2>Inboxes</h2>
        <div className="sync-section">
          <button
            type="button"
            className={`sync-button ${isSyncing ? 'syncing' : ''}`}
            onClick={onSyncButtonClick}
            disabled={isSyncing}
            title="Sync notifications"
          >
            <span className={isSyncing ? 'spinning' : ''}>{isSyncing ? '↻' : '↻'}</span>
            {isSyncing ? 'Syncing...' : 'Sync'}
          </button>
          <div className="last-sync">
            {isSyncing ? 'Syncing...' : lastSyncDisplayText}
          </div>
        </div>
      </div>

      <div className="inbox-list">
        <div
          className={`inbox-item ${currentInbox === null ? 'active' : ''}`}
          onClick={handleAllNotificationsClick}
        >
          <span className="inbox-name">All Notifications</span>
        </div>

        {inboxes.map(inbox => (
          <div
            key={inbox.id}
            className={`inbox-item ${currentInbox?.id === inbox.id ? 'active' : ''}`}
            onClick={() => handleInboxClick(inbox)}
            onContextMenu={e => handleInboxContextMenu(e, inbox)}
          >
            <span className="inbox-name">{inbox.name}</span>
          </div>
        ))}
      </div>

      <div className="sidebar-footer">
        <button
          className="add-inbox-btn"
          onClick={onCreateInbox}
          title="Create new inbox"
        >
          + Add Inbox
        </button>
        <button
          className="preferences-btn"
          onClick={onShowPreferences}
          title="Open preferences"
        >
          ⚙️ Preferences
        </button>
      </div>
    </div>
  )
}

export default Sidebar
