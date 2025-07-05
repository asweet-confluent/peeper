import type { Inbox } from '../../../preload/src/types.js'
import React, { useEffect } from 'react'

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
  onEditInbox: (inbox: Inbox) => void
  onDeleteInbox: (inbox: Inbox) => void
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
  onEditInbox,
  onDeleteInbox,
  onShowPreferences,
  isSyncing = false,
}) => {
  const [lastSyncDisplayText, setLastSyncDisplayText] = React.useState<string>(calculateLastSyncDisplayText(lastSyncTime))
  console.log('Rendering Sidebar with lastSyncTime:', lastSyncTime?.toISOString())

  const handleInboxClick = (inbox: Inbox) => {
    onSelectInbox(inbox)
  }

  const handleAllNotificationsClick = () => {
    onSelectInbox(null)
  }

  const handleInboxContextMenu = (e: React.MouseEvent, inbox: Inbox) => {
    e.preventDefault()
    e.stopPropagation()

    const contextMenu = document.createElement('div')
    contextMenu.className = 'context-menu'
    contextMenu.innerHTML = `
      <div class="context-menu-item" data-action="edit">Edit</div>
      <div class="context-menu-item" data-action="delete">Delete</div>
    `

    contextMenu.style.position = 'fixed'
    contextMenu.style.left = `${e.clientX}px`
    contextMenu.style.top = `${e.clientY}px`
    contextMenu.style.zIndex = '1000'

    document.body.appendChild(contextMenu)

    const handleContextMenuClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      const action = target.getAttribute('data-action')

      if (action === 'edit') {
        onEditInbox(inbox)
      }
      else if (action === 'delete') {
        onDeleteInbox(inbox)
      }

      document.body.removeChild(contextMenu)
      document.removeEventListener('click', handleContextMenuClick)
    }

    const handleOutsideClick = (event: MouseEvent) => {
      if (!contextMenu.contains(event.target as Node)) {
        document.body.removeChild(contextMenu)
        document.removeEventListener('click', handleOutsideClick)
      }
    }

    setTimeout(() => {
      document.addEventListener('click', handleOutsideClick)
    }, 0)

    contextMenu.addEventListener('click', handleContextMenuClick)
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
