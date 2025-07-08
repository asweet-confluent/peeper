import { create } from "zustand";
import type { Inbox } from '../../../preload/src/types.js'
import { createSelectors } from "../utils.js";
import { combine } from "zustand/middleware";
import { immer } from 'zustand/middleware/immer'
import { produce } from "immer";

interface PeeperState {
  inboxes: Inbox[];
  currentInbox: Inbox | null;
  // showInboxModal: boolean;
  showPreferencesModal: boolean;
  editingInbox: Inbox | null;
  lastSyncTime: Date | null;
  isSyncing: boolean;
  refreshTrigger: number;
  contextMenu: {
    x: number;
    y: number;
    visible: boolean;
    inbox: Inbox | null;
  };
  showInboxModal: boolean;
  setInboxes: (inboxes: Inbox[]) => void;
  setCurrentInbox: (inbox: Inbox | null) => void;
  setShowInboxModal: (show: boolean) => void;
  setShowPreferencesModal: (show: boolean) => void;
  setEditingInbox: (inbox: Inbox | null) => void;
  setLastSyncTime: (time: Date | null) => void;
  setIsSyncing: (isSyncing: boolean) => void;
  incrementRefreshTrigger: () => void;
  enableContextMenu: (x: number, y: number, inbox: Inbox | null) => void;
  disableContextMenu: () => void;

  saveInbox: (inbox: Inbox) => void;
  deleteInbox: (inbox: Inbox) => void;
}

const usePeeperStoreBase = create<PeeperState>()((set) => (
  {
    inboxes: [],
    currentInbox: null,
    showInboxModal: false,
    showPreferencesModal: false,
    editingInbox: null,
    lastSyncTime: null,
    isSyncing: false,
    refreshTrigger: 0,
    contextMenu: {
      x: 0,
      y: 0,
      visible: false,
      inbox: null,
    },

    setInboxes: (inboxes) => set({ inboxes }),
    setCurrentInbox: (inbox: Inbox | null) => set({ currentInbox: inbox }),
    setEditingInbox: (inbox: Inbox | null) => set({ editingInbox: inbox }),
    setLastSyncTime: (time: Date | null) => set({ lastSyncTime: time }),
    setIsSyncing: (isSyncing: boolean) => set({ isSyncing }),
    incrementRefreshTrigger: () => set((state) => ({ refreshTrigger: state.refreshTrigger + 1 })),
    setShowInboxModal: (show: boolean) => set({ showInboxModal: show }),
    setShowPreferencesModal: (show: boolean) => set({ showPreferencesModal: show }),
    enableContextMenu: (x: number, y: number, inbox: Inbox | null) => set(produce((state) => {
      state.contextMenu = { x, y, visible: true, inbox };
    })),
    disableContextMenu: () => set(produce((state) => {
      state.contextMenu.visible = false;
      state.contextMenu.inbox = null;
    })),
    saveInbox: (inbox: Inbox) => set(produce((state: PeeperState) => {
      const index = state.inboxes.findIndex(i => i.id === inbox.id);
      if (index !== -1) {
        state.inboxes[index] = inbox;
      } else {
        state.inboxes.push(inbox);
      }
      if (!state.currentInbox) {
        state.currentInbox = inbox;
      }
      state.editingInbox = null; // Reset editing state after save
      state.showInboxModal = false; // Close modal after save
    })),
    deleteInbox: (inbox: Inbox) => set(produce((state: PeeperState) => {
      state.inboxes = state.inboxes.filter(i => i.id !== inbox.id);
      if (state.currentInbox?.id === inbox.id) {
        state.currentInbox = null;
      }
    }))
  })
)

export const usePeeperStore = createSelectors(usePeeperStoreBase);