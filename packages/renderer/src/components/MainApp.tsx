/* eslint-disable no-alert */
import type { Inbox, SyncResult } from '../../../preload/src/types.js'
import React, { useCallback, useEffect, useState } from 'react'
import InboxModal from './InboxModal.js'
import NotificationList from './NotificationList.js'
import PreferencesModal from './PreferencesModal.js'
import QuickFiltersDropdown from './QuickFiltersDropdown.js'
import Sidebar from './Sidebar.js'
import { usePeeperStore } from './store.js'

const MainApp: React.FC = () => {
  const inboxes = usePeeperStore.use.inboxes()
  const setInboxes = usePeeperStore.use.setInboxes()
  const currentInbox = usePeeperStore.use.currentInbox()
  const setCurrentInbox = usePeeperStore.use.setCurrentInbox()
  const showInboxModal = usePeeperStore.use.showInboxModal()
  const setShowInboxModal = usePeeperStore.use.setShowInboxModal()
  const showPreferencesModal = usePeeperStore.use.showPreferencesModal()
  const setShowPreferencesModal = usePeeperStore.use.setShowPreferencesModal()
  const editingInbox = usePeeperStore.use.editingInbox()
  const setEditingInbox = usePeeperStore.use.setEditingInbox()
  const lastSyncTime = usePeeperStore.use.lastSyncTime()
  const setLastSyncTime = usePeeperStore.use.setLastSyncTime()
  const isSyncing = usePeeperStore.use.isSyncing()
  const setIsSyncing = usePeeperStore.use.setIsSyncing()
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
      const success = await window.api.invoke.markAsRead(notificationId)
      if (!success) {
        console.error('Failed to mark notification as read')
      }
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
    console.log('Creating new inbox')
    setEditingInbox(null)
    setShowInboxModal(true)
  }

  const handleEditInbox = (inbox: Inbox) => {
    setEditingInbox(inbox)
    setShowInboxModal(true)
  }


  const handleSaveInbox = async (inbox: Inbox) => {
    console.log('Saving inbox:', inbox) 
    try {
      if (editingInbox && editingInbox.id) {
        inbox.id = editingInbox.id
        await window.api.invoke.updateInbox(inbox)
      }
      else {
        await window.api.invoke.createInbox(inbox)
      }
      setShowInboxModal(false)
      setEditingInbox(null)
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
        onShowPreferences={() => setShowPreferencesModal(true)}
        isSyncing={isSyncing}
      />

      <div className="main-content">
        <div className="main-header">
          <h1>{currentInbox ? currentInbox.name : 'All Notifications'}</h1>
          <QuickFiltersDropdown 
            inboxId={currentInbox?.id}
            onConfigChange={() => setRefreshTrigger(prev => prev + 1)}
          />
        </div>

        <NotificationList
          onMarkAsRead={markAsRead}
          inboxId={currentInbox?.id}
          refreshTrigger={refreshTrigger}
        />
      </div>

      {showInboxModal && (
        <InboxModal />
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
