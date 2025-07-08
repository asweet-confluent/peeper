import { useEffect } from "react"
import type { Inbox } from "../../../preload/src/types"
import { usePeeperStore } from "./store"

const ContextMenu: React.FC<{ ref: React.Ref<HTMLDivElement> }> = ({ ref }) => {
  const contextMenu = usePeeperStore.use.contextMenu()
  const setEditingInbox = usePeeperStore.use.setEditingInbox()
  const deleteInbox = usePeeperStore.use.deleteInbox()
  const disableContextMenu = usePeeperStore.use.disableContextMenu()
  const setShowInboxModal = usePeeperStore.use.setShowInboxModal()

  useEffect(() => {
    const handleClick = () => {
      disableContextMenu()
    }
    document.addEventListener("click", handleClick)
    return () => {
      document.removeEventListener("click", handleClick)
    }
  }, [])

  const onEdit = () => {
    console.log("Editing inbox:", contextMenu.inbox)
    setEditingInbox(contextMenu.inbox)
    setShowInboxModal(true)
  }

  const handleDeleteInbox = async (inbox: Inbox | null) => {
    if (!inbox) {
      console.warn("No inbox selected for deletion")
      return
    }
    if (inbox.id && confirm(`Are you sure you want to delete "${inbox.name}"?`)) {
      await window.api.invoke.deleteInbox(inbox.id)
      deleteInbox(inbox)
    }
  }

  return (
    <div className="context-menu"
      ref={ref}
      style={{
        position: 'fixed',
        left: contextMenu.x,
        top: contextMenu.y,
        zIndex: 1000,

      }}>
      <div className="context-menu-item" data-action="edit" onClick={onEdit}>Edit</div>
      <div className="context-menu-item" data-action="delete" onClick={() => handleDeleteInbox(contextMenu.inbox)}>Delete</div>
    </div>
  )
}

export default ContextMenu