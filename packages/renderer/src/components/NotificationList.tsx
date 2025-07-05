import type { StoredNotification } from '../../../preload/src/types.js'
import React, { useEffect, useState } from 'react'

interface NotificationListProps {
  notifications: StoredNotification[]
  onMarkAsRead: (notificationId: string) => void
}

const PRStatusBadge: React.FC<{ notification: StoredNotification }> = ({ notification }) => {
  if (notification.subject_type !== 'PullRequest') {
    return null
  }

  // Determine status based on pr_state, pr_merged, and pr_draft
  let status: string
  let statusClass: string

  if (notification.pr_merged === 1) {
    status = 'merged'
    statusClass = 'pr-status-merged'
  }
  else if (notification.pr_draft === 1) {
    status = 'draft'
    statusClass = 'pr-status-draft'
  }
  else if (notification.pr_state === 'closed') {
    status = 'closed'
    statusClass = 'pr-status-closed'
  }
  else if (notification.pr_state === 'open') {
    status = 'open'
    statusClass = 'pr-status-open'
  }
  else {
    // Fallback if no PR state is available
    return null
  }

  return (
    <span className={`pr-status-badge ${statusClass}`}>
      {status}
    </span>
  )
}

const AuthorSection: React.FC<{ notification: StoredNotification }> = ({ notification }) => {
  const [authorProfile, setAuthorProfile] = useState<any>(null)

  const fetchUserProfile = async (username: string) => {
    try {
      const profile = await window.api.invoke.fetchUserProfile(username)
      if (profile) {
        setAuthorProfile(profile)
        return profile
      }
    }
    catch (error) {
      console.error('Error fetching user profile:', error)
    }
    return null
  }

  useEffect(() => {
    if (notification.subject_type === 'PullRequest' && notification.pr_author) {
      fetchUserProfile(notification.pr_author)
    }
  }, [notification.pr_author, notification.subject_type])

  if (notification.subject_type !== 'PullRequest' || !notification.pr_author) {
    return null
  }

  if (authorProfile) {
    return (
      <div className="pr-author-compact">
        <a
          href={`https://github.com/${authorProfile.login}`}
          className="author-profile-link-compact"
          onClick={(e) => {
            e.preventDefault()
            window.api.invoke.openExternal(`https://github.com/${authorProfile.login}`)
          }}
        >
          <img
            src={authorProfile.avatar_url}
            alt={authorProfile.login}
            className="author-avatar-small"
          />
          <span className="author-name-small">
            @
            {authorProfile.login}
          </span>
        </a>
      </div>
    )
  }
  else {
    return (
      <div className="pr-author-compact">
        <div className="author-avatar-placeholder-small">?</div>
        <span className="author-name-small">
          @
          {notification.pr_author}
        </span>
      </div>
    )
  }
}

const NotificationList: React.FC<NotificationListProps> = ({
  notifications,
  onMarkAsRead,
}) => {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  const escapeHtml = (text: string) => {
    const div = document.createElement('div')
    div.textContent = text
    return div.innerHTML
  }

  const handleNotificationClick = (url: string, notificationId: string, isUnread: boolean) => {
    if (url && url !== '#') {
      window.api.invoke.openExternal(url)
      if (isUnread) {
        onMarkAsRead(notificationId)
      }
    }
  }

  const handleMarkAsReadClick = (e: React.MouseEvent, notificationId: string) => {
    e.stopPropagation()
    onMarkAsRead(notificationId)
  }

  if (notifications.length === 0) {
    return (
      <div className="notification-list">
        <div className="empty-state">
          <h3>No notifications</h3>
          <p>You're all caught up!</p>
        </div>
      </div>
    )
  }

  return (
    <div className="notification-list">
      {notifications.map(notification => (
        <div
          key={notification.id}
          className={`notification-item ${notification.unread ? 'unread' : ''}`}
        >
          <div className="notification-content">
            <div className="notification-header">
              <a
                href="#"
                className="notification-title"
                onClick={(e) => {
                  e.preventDefault()
                  handleNotificationClick(notification.subject_url || '#', notification.id, !!notification.unread)
                }}
              >
                {escapeHtml(notification.subject_title)}
              </a>
              <div className="notification-meta">
                <span className="notification-type">{escapeHtml(notification.subject_type)}</span>
                <PRStatusBadge notification={notification} />
                <span className="notification-reason">{escapeHtml(notification.reason)}</span>
              </div>
            </div>
            <div className="notification-meta">
              <a
                href="#"
                className="notification-repository"
                onClick={(e) => {
                  e.preventDefault()
                  window.api.invoke.openExternal(`https://github.com/${notification.repository_full_name}`)
                }}
              >
                {escapeHtml(notification.repository_full_name)}
              </a>
              <span>{formatDate(notification.updated_at)}</span>
            </div>
            <div className="notification-actions">
              {!!notification.unread && (
                <button
                  type="button"
                  className="action-btn primary"
                  onClick={e => handleMarkAsReadClick(e, notification.id)}
                >
                  Mark as Read
                </button>
              )}
              <button
                type="button"
                className="action-btn"
                onClick={(e) => {
                  e.stopPropagation()
                  handleNotificationClick(notification.subject_url || '#', notification.id, false)
                }}
              >
                View
              </button>
            </div>
            <AuthorSection notification={notification} />
          </div>
        </div>
      ))}
    </div>
  )
}

export default React.memo(NotificationList)
