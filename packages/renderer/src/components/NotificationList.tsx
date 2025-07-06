import type { StoredNotification, PaginatedNotificationsResult } from '../../../preload/src/types.js'
import React, { useEffect, useState, memo, useCallback, useRef } from 'react'
import { VariableSizeList as List } from 'react-window'
import InfiniteLoader from 'react-window-infinite-loader'

// Constants for better maintainability
const HEADER_HEIGHT = 80
const DEFAULT_ITEM_HEIGHT = 175 // Initial estimate, will be measured dynamically
const OVERSCAN_COUNT = 5

interface NotificationListProps {
  onMarkAsRead: (notificationId: string) => void
  initialPageSize?: number
  inboxId?: number // For filtered notifications
  refreshTrigger?: number // Prop to trigger refresh without remounting
}

interface NotificationItemProps {
  index: number
  style: React.CSSProperties
  data: {
    notifications: StoredNotification[]
    onMarkAsRead: (notificationId: string) => void
    formatDate: (dateString: string) => string
    escapeHtml: (text: string) => string
    handleNotificationClick: (url: string, notificationId: string, isUnread: boolean) => void
    handleMarkAsReadClick: (e: React.MouseEvent, notificationId: string) => void
    handleMarkAsUnreadClick: (e: React.MouseEvent, notificationId: string) => void
    handleMarkAsDoneClick: (e: React.MouseEvent, notificationId: string) => void
    setItemHeight: (index: number, height: number) => void
  }
}

const PRStatusBadge: React.FC<{ notification: StoredNotification }> = memo(({ notification }) => {
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
})

PRStatusBadge.displayName = 'PRStatusBadge'

const AuthorSection: React.FC<{ notification: StoredNotification }> = memo(({ notification }) => {
  const [authorProfile, setAuthorProfile] = useState<any>(null)

  const fetchUserProfile = useCallback(async (username: string) => {
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
  }, [])

  useEffect(() => {
    if (notification.subject_type === 'PullRequest' && notification.pr_author) {
      fetchUserProfile(notification.pr_author)
    }
  }, [notification.pr_author, notification.subject_type, fetchUserProfile])

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
})

AuthorSection.displayName = 'AuthorSection'

const NotificationItem: React.FC<NotificationItemProps> = memo(({ index, style, data }) => {
  const { 
    notifications, 
    onMarkAsRead, 
    formatDate, 
    escapeHtml, 
    handleNotificationClick, 
    handleMarkAsReadClick,
    handleMarkAsUnreadClick,
    handleMarkAsDoneClick,
    setItemHeight
  } = data
  
  const notification = notifications[index]
  const itemRef = useRef<HTMLDivElement>(null)
  const heightMeasured = useRef(false)

  // Measure the height only once when the component mounts or when the notification changes
  useEffect(() => {
    if (itemRef.current && notification && !heightMeasured.current) {
      const height = itemRef.current.offsetHeight
      setItemHeight(index, height)
      heightMeasured.current = true
    }
  }, [index, notification?.id, setItemHeight])

  // Reset height measurement flag when notification changes
  useEffect(() => {
    heightMeasured.current = false
  }, [notification?.id])

  // Handle loading state for infinite loader
  if (!notification) {
    return (
      <div style={style}>
        <div className="notification-item loading">
          <div className="notification-content">
            <div className="loading-placeholder">
              Loading...
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={style}>
      <div
        ref={itemRef}
        className={`notification-item ${notification.unread ? 'unread' : ''}`}
      >
        <div className="notification-content">
          <div className="notification-header">
            <a
              href="#"
              className="notification-title"
              onClick={(e) => {
                e.preventDefault()
                const url = `https://github.com/`
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
            {!notification.unread && (
              <button
                type="button"
                className="action-btn"
                onClick={e => handleMarkAsUnreadClick(e, notification.id)}
              >
                Mark as Unread
              </button>
            )}
            <button
              type="button"
              className="action-btn"
              onClick={e => handleMarkAsDoneClick(e, notification.id)}
            >
              Mark as Done
            </button>
          </div>
          <AuthorSection notification={notification} />
        </div>
      </div>
    </div>
  )
})

NotificationItem.displayName = 'NotificationItem'

const NotificationList: React.FC<NotificationListProps> = ({
  onMarkAsRead,
  initialPageSize = 50,
  inboxId,
  refreshTrigger,
}) => {
  const [containerHeight, setContainerHeight] = useState(window.innerHeight - HEADER_HEIGHT)
  const [allNotifications, setAllNotifications] = useState<StoredNotification[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [currentPage, setCurrentPage] = useState(0)
  const [totalCount, setTotalCount] = useState(0)
  const listRef = useRef<any>(null)
  const itemHeights = useRef<Map<number, number>>(new Map())
  const loadingRef = useRef(false)

  // Load notifications for infinite mode
  const loadNotifications = useCallback(async (page: number = 0, reset: boolean = false) => {
    if (loadingRef.current) return // Prevent multiple simultaneous loads
    
    console.log('NotificationList: loadNotifications called with page:', page, 'reset:', reset, 'inboxId:', inboxId)
    
    loadingRef.current = true
    setIsLoading(true)
    try {
      let result: PaginatedNotificationsResult
      
      if (inboxId) {
        console.log('NotificationList: Loading filtered notifications for inbox:', inboxId)
        result = await window.api.invoke.getFilteredNotificationsPaginated(inboxId, page, initialPageSize)
      } else {
        console.log('NotificationList: Loading all notifications')
        result = await window.api.invoke.getNotificationsPaginated(page, initialPageSize)
      }
      
      console.log('NotificationList: Loaded', result.notifications.length, 'notifications, hasMore:', result.hasMore)
      
      if (reset) {
        setAllNotifications(result.notifications)
      } else {
        setAllNotifications(prev => [...prev, ...result.notifications])
      }
      
      setHasMore(result.hasMore)
      setTotalCount(result.totalCount)
      setCurrentPage(page)
    } catch (error) {
      console.error('Error loading notifications:', error)
    } finally {
      setIsLoading(false)
      loadingRef.current = false
    }
  }, [initialPageSize, inboxId]) // Added inboxId back to dependencies

  // Initial load and reset when inboxId changes
  useEffect(() => {
    console.log('NotificationList: inboxId changed to:', inboxId)
    setAllNotifications([])
    setCurrentPage(0)
    setHasMore(true)
    setIsLoading(false)
    loadingRef.current = false
    itemHeights.current.clear()
    if (listRef.current) {
      listRef.current.resetAfterIndex(0)
    }
    loadNotifications(0, true)
  }, [inboxId, loadNotifications]) // Combined initial load and reset logic

  // Refresh when refreshTrigger changes
  useEffect(() => {
    if (refreshTrigger !== undefined && refreshTrigger > 0) {
      console.log('NotificationList: Refresh triggered by parent')
      setAllNotifications([])
      setCurrentPage(0)
      setHasMore(true)
      setIsLoading(false)
      loadingRef.current = false
      itemHeights.current.clear()
      if (listRef.current) {
        listRef.current.resetAfterIndex(0)
      }
      loadNotifications(0, true)
    }
  }, [refreshTrigger])

  // Always use infinite mode data
  const displayNotifications = allNotifications

  // Handle window resize to update container height and reset item sizes
  useEffect(() => {
    const handleResize = () => {
      setContainerHeight(window.innerHeight - HEADER_HEIGHT)
      // Clear cached heights on resize since content wrapping may change
      itemHeights.current.clear()
      if (listRef.current) {
        listRef.current.resetAfterIndex(0)
      }
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Function to get the height of an item
  const getItemSize = useCallback((index: number) => {
    return itemHeights.current.get(index) || DEFAULT_ITEM_HEIGHT
  }, [])

  // Function to set item height after it's measured
  const setItemHeight = useCallback((index: number, height: number) => {
    if (itemHeights.current.get(index) !== height) {
      itemHeights.current.set(index, height)
      if (listRef.current) {
        listRef.current.resetAfterIndex(index)
      }
    }
  }, [])

  const formatDate = useCallback((dateString: string) => {
    return new Date(dateString).toLocaleString()
  }, [])

  const escapeHtml = useCallback((text: string) => {
    const div = document.createElement('div')
    div.textContent = text
    return div.innerHTML
  }, [])

  const handleNotificationClick = useCallback((url: string, notificationId: string, isUnread: boolean) => {
    if (url && url !== '#') {
      window.api.invoke.openExternal(url)
      if (isUnread) {
        onMarkAsRead(notificationId)
      }
    }
  }, [onMarkAsRead])

  const handleMarkAsReadClick = useCallback((e: React.MouseEvent, notificationId: string) => {
    e.stopPropagation()
    onMarkAsRead(notificationId)
  }, [onMarkAsRead])

  const handleMarkAsUnreadClick = useCallback(async (e: React.MouseEvent, notificationId: string) => {
    e.stopPropagation()
    try {
      const success = await window.api.invoke.markAsUnread(notificationId)
      if (success) {
        // Refresh the list to show updated read status
        setAllNotifications([])
        setCurrentPage(0)
        setHasMore(true)
        setIsLoading(false)
        loadingRef.current = false
        itemHeights.current.clear()
        if (listRef.current) {
          listRef.current.resetAfterIndex(0)
        }
        loadNotifications(0, true)
      } else {
        console.error('Failed to mark notification as unread')
      }
    } catch (error) {
      console.error('Error marking as unread:', error)
    }
  }, [loadNotifications])

  const handleMarkAsDoneClick = useCallback(async (e: React.MouseEvent, notificationId: string) => {
    e.stopPropagation()
    try {
      const success = await window.api.invoke.markAsDone(notificationId)
      if (success) {
        // Refresh the list to reflect changes based on current filters
        setAllNotifications([])
        setCurrentPage(0)
        setHasMore(true)
        setIsLoading(false)
        loadingRef.current = false
        itemHeights.current.clear()
        if (listRef.current) {
          listRef.current.resetAfterIndex(0)
        }
        loadNotifications(0, true)
      } else {
        console.error('Failed to mark notification as done')
      }
    } catch (error) {
      console.error('Error marking as done:', error)
    }
  }, [loadNotifications])

  // Function to check if an item is loaded
  const isItemLoaded = useCallback((index: number) => {
    return index < displayNotifications.length
  }, [displayNotifications.length])

  // Function to load more items
  const loadMoreItems = useCallback(async (_startIndex: number, _stopIndex: number) => {
    if (!hasMore || loadingRef.current) return
    
    const nextPage = currentPage + 1
    await loadNotifications(nextPage)
  }, [hasMore, currentPage, loadNotifications])

  // Memoize the data object to prevent unnecessary re-renders
  const itemData = React.useMemo(() => ({
    notifications: displayNotifications,
    onMarkAsRead,
    formatDate,
    escapeHtml,
    handleNotificationClick,
    handleMarkAsReadClick,
    handleMarkAsUnreadClick,
    handleMarkAsDoneClick,
    setItemHeight
  }), [displayNotifications, onMarkAsRead, formatDate, escapeHtml, handleNotificationClick, handleMarkAsReadClick, handleMarkAsUnreadClick, handleMarkAsDoneClick, setItemHeight])

  if (displayNotifications.length === 0 && !isLoading) {
    return (
      <div className="notification-list">
        <div className="empty-state">
          <h3>No notifications</h3>
          <p>You're all caught up!</p>
        </div>
      </div>
    )
  }

  // Calculate item count for infinite loader
  const itemCount = hasMore ? displayNotifications.length + 1 : displayNotifications.length

  return (
    <div className="notification-list">
      <InfiniteLoader
        isItemLoaded={isItemLoaded}
        itemCount={itemCount}
        loadMoreItems={loadMoreItems}
      >
        {({ onItemsRendered, ref }) => (
          <List
            ref={(list) => {
              listRef.current = list
              ref(list)
            }}
            height={containerHeight}
            width="100%"
            itemCount={itemCount}
            itemSize={getItemSize}
            itemData={itemData}
            overscanCount={OVERSCAN_COUNT}
            onItemsRendered={onItemsRendered}
          >
            {NotificationItem}
          </List>
        )}
      </InfiniteLoader>
    </div>
  )
}

export default memo(NotificationList)
