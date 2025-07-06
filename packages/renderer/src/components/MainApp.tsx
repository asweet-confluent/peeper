/* eslint-disable no-alert */
import type { Inbox, SyncResult } from '../../../preload/src/types.js'
import React, { useCallback, useEffect, useState } from 'react'
import InboxModal from './InboxModal.js'
import NotificationList from './NotificationList.js'
import PreferencesModal from './PreferencesModal.js'
import Sidebar from './Sidebar.js'

const MainApp: React.FC = () => {
  const [inboxes, setInboxes] = useState<Inbox[]>([])
  const [currentInbox, setCurrentInbox] = useState<Inbox | null>(null)
  const [showInboxModal, setShowInboxModal] = useState(false)
  const [showPreferencesModal, setShowPreferencesModal] = useState(false)
  const [editingInbox, setEditingInbox] = useState<Inbox | null>(null)
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null)
  const [isSyncing, setIsSyncing] = useState(false)
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  useEffect(() => {
    const handleGetInboxesResponse = async (inboxes: Inbox[]) => {
      try {
        setInboxes(inboxes)
      }
      catch (error) {
        console.error('Error loading inboxes:', error)
      }
    }
    window.api.invoke.getInboxes().then(handleGetInboxesResponse).catch((error) => {
      console.error('Error fetching inboxes:', error)
    })
  }, [])

  // NotificationList handles inboxId changes automatically, no need to force refresh
  // useEffect(() => {
  //   console.log('MainApp: currentInbox changed, refreshing NotificationList for:', currentInbox?.name || 'All Notifications')
  //   setRefreshTrigger(prev => prev + 1)
  // }, [currentInbox])

  // const selectInbox = async (inbox: Inbox | null) => {
  //   setCurrentInbox(inbox)
  //   if (inbox) {
  //     await loadFilteredNotifications(inbox)
  //   }
  //   else {
  //     await loadNotifications()
  //   }
  // }

  // Triggered by clicking the sync button
  const syncNotifications = async () => {
    setIsSyncing(true)
    try {
      await window.api.invoke.syncNotifications()
    } catch (error) {
      console.error('Error during sync:', error)
      setIsSyncing(false)
    }
  }

  const markAsRead = async (notificationId: string) => {
    try {
      await window.api.invoke.markAsRead(notificationId)
    }
    catch (error) {
      console.error('Error marking as read:', error)
    }
  }

  useEffect(() => {
    window.api.invoke.getLastSyncTime().then((newSyncTime) => {
      if (newSyncTime) {
        setLastSyncTime(new Date(newSyncTime))
      }
      else {
        setLastSyncTime(null)
      }
    }).catch((error) => {
      console.error('Error fetching last sync time:', error)
    })
  }, [])

  useEffect(() => {
    // Listen for all sync completion events (both manual and automatic)
    const handleSyncCompleted = async (_e: any, result: SyncResult) => {
      setIsSyncing(false)
      
      if (!result.success) {
        console.error('Sync failed:', result.error)
        return
      }
      console.log('Sync completed:', result)
      if (result.syncTime) {
        setLastSyncTime(new Date(result.syncTime))
      }
      
      // Only refresh notifications if there were actual changes
      console.log('MainApp: Sync completed with newCount:', result.newCount)
      if (result.newCount === undefined || result.newCount > 0) {
        console.log('MainApp: Refreshing NotificationList after sync')
        // Force NotificationList to refresh by updating the trigger
        setRefreshTrigger(prev => prev + 1)
      } else {
        console.log('MainApp: No new notifications, skipping refresh')
      }
    }

    // Set up the event listener only once
    window.api.on.syncCompleted(handleSyncCompleted)
  }, []) // No dependencies - set up once only

  const handleCreateInbox = () => {
    setEditingInbox(null)
    setShowInboxModal(true)
  }

  const handleEditInbox = (inbox: Inbox) => {
    setEditingInbox(inbox)
    setShowInboxModal(true)
  }

  const handleDeleteInbox = async (inbox: Inbox) => {
    if (inbox.id && confirm(`Are you sure you want to delete "${inbox.name}"?`)) {
      await window.api.invoke.deleteInbox(inbox.id)
      if (currentInbox?.id === inbox.id) {
        setCurrentInbox(null)
      }
      // Remove it from the state
      setInboxes(inboxes.filter(i => i.id !== inbox.id))
    }
  }

  const handleSaveInbox = async (inbox: Inbox) => {
    try {
      if (editingInbox && editingInbox.id) {
        inbox.id = editingInbox.id
        await window.api.invoke.updateInbox(inbox)
      }
      else {
        await window.api.invoke.createInbox(inbox)
      }
      setShowInboxModal(false)
    }
    catch (error) {
      console.error('Error saving inbox:', error)
    }
  }

  // useEffect(loadInboxes, [currentInbox])
  // useEffect(() => {
  // loadNotifications()
  // startLastSyncUpdateTimer()
  // setupSyncListener()

  // }, [])

  return (
    <div className="app-container">
      <Sidebar
        inboxes={inboxes}
        currentInbox={currentInbox}
        lastSyncTime={lastSyncTime}
        onSelectInbox={setCurrentInbox}
        onSyncButtonClick={syncNotifications}
        onCreateInbox={handleCreateInbox}
        onEditInbox={handleEditInbox}
        onDeleteInbox={handleDeleteInbox}
        onShowPreferences={() => setShowPreferencesModal(true)}
        isSyncing={isSyncing}
      />

      <div className="main-content">
        <div className="main-header">
          <h1>{currentInbox ? currentInbox.name : 'All Notifications'}</h1>
        </div>

        <NotificationList
          onMarkAsRead={markAsRead}
          inboxId={currentInbox?.id}
          refreshTrigger={refreshTrigger}
        />
      </div>

      {showInboxModal && (
        <InboxModal
          inbox={editingInbox}
          onSave={handleSaveInbox}
          onCancel={() => setShowInboxModal(false)}
        />
      )}

      {showPreferencesModal && (
        <PreferencesModal
          onClose={() => setShowPreferencesModal(false)}
        />
      )}
    </div>
  )
}

export default MainApp
