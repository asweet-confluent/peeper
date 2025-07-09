import type { Inbox } from '../../../preload/src/types.js'
import React, { useEffect, useState } from 'react'
import FilterAutocomplete from './FilterAutocomplete.js'
import { usePeeperStore } from './store.js'

interface InboxModalProps {
}

const InboxModal: React.FC<InboxModalProps> = ({}) => {
  const [name, setName] = useState('')
  const [filterExpression, setFilterExpression] = useState('')
  const [desktopNotifications, setDesktopNotifications] = useState(false)
  
  const editingInbox = usePeeperStore.use.editingInbox()
  const saveInbox = usePeeperStore.use.saveInbox()

  const setEditingInbox = usePeeperStore.use.setEditingInbox()
  const setShowInboxModal = usePeeperStore.use.setShowInboxModal()
  const onCancel = () => {
    setEditingInbox(null)
    setShowInboxModal(false)
  }

  useEffect(() => {
    if (editingInbox) {
      setName(editingInbox.name)
      setFilterExpression(editingInbox.filter_expression || '')
      setDesktopNotifications(!!editingInbox.desktop_notifications)
    }
    else {
      setName('')
      setFilterExpression('')
      setDesktopNotifications(false)
    }
  }, [editingInbox])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!name.trim() || !filterExpression.trim()) {
      return
    }

    const newInbox: Inbox = {
      ...(editingInbox || {}),
      name: name.trim(),
      filter_expression: filterExpression.trim(),
      desktop_notifications: desktopNotifications ? 1 : 0,
    }
    
    // TODO: Refactor API to provide a single upsertInbox method
    if (editingInbox) {
      window.api.invoke.updateInbox(newInbox)
      saveInbox(newInbox)
    } else {
      newInbox.id = await window.api.invoke.createInbox(newInbox)
      saveInbox(newInbox)
    }

  }

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onCancel()
    }
  }

  const filterTemplates = [
    {
      name: 'Pull Requests',
      expression: 'subject_type === "PullRequest"',
      description: 'All pull request notifications',
    },
    {
      name: 'Issues',
      expression: 'subject_type === "Issue"',
      description: 'All issue notifications',
    },
    {
      name: 'Review Requests',
      expression: 'reason === "review_requested"',
      description: 'Pull requests where you are requested to review',
    },
    {
      name: 'Mentions',
      expression: 'reason === "mention" OR reason === "team_mention"',
      description: 'When you or your team are mentioned',
    },
    {
      name: 'Author',
      expression: 'reason === "author"',
      description: 'Updates on items you created',
    },
    {
      name: 'Assigned',
      expression: 'reason === "assign"',
      description: 'Items assigned to you',
    },
    {
      name: 'Security Alerts',
      expression: 'reason === "security_alert"',
      description: 'Security vulnerability alerts',
    },
  ]

  const handleTemplateClick = (template: { name: string, expression: string, description: string }) => {
    setFilterExpression(template.expression)
  }

  return (
    <div className="modal-backdrop" onClick={handleBackdropClick}>
      <div className="modal-content inbox-modal">
        <div className="modal-header">
          <h2>{editingInbox ? 'Edit Inbox' : 'Create Inbox'}</h2>
          <button
            className="modal-close"
            onClick={onCancel}
            type="button"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="input-group">
              <label htmlFor="inbox-name">Name</label>
              <input
                id="inbox-name"
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Enter inbox name"
                required
              />
            </div>

            <div className="input-group">
              <label htmlFor="filter-expression">Filter Expression</label>
              <FilterAutocomplete
                value={filterExpression}
                onChange={setFilterExpression}
                placeholder="Enter filter expression (e.g., reason === 'review_requested')"
                rows={3}
                required={true}
              />
              <div className="filter-help">
                <details>
                  <summary>Available fields and examples</summary>
                  <div className="filter-help-content">
                    <p><strong>Basic Notification Fields:</strong></p>
                    <ul>
                      <li>
                        <code>subject_title</code>
                        {' '}
                        - Title of the notification subject
                      </li>
                      <li>
                        <code>subject_type</code>
                        {' '}
                        - Issue, PullRequest, Release, Commit, Discussion, etc.
                      </li>
                      <li>
                        <code>repository_name</code>
                        {' '}
                        - Repository name only
                      </li>
                      <li>
                        <code>repository_owner</code>
                        {' '}
                        - Repository owner username
                      </li>
                      <li>
                        <code>repository_full_name</code>
                        {' '}
                        - Full repository name (owner/repo)
                      </li>
                      <li>
                        <code>reason</code>
                        {' '}
                        - assign, author, comment, mention, review_requested, team_mention, etc.
                      </li>
                      <li>
                        <code>unread</code>
                        {' '}
                        - Whether notification is unread (true/false)
                      </li>
                      <li>
                        <code>updated_at</code>
                        {' '}
                        - When the notification was last updated
                      </li>
                      <li>
                        <code>done</code>
                        {' '}
                        - User-defined workflow state (true/false)
                      </li>
                    </ul>
                    
                    <p><strong>Pull Request Fields:</strong></p>
                    <ul>
                      <li>
                        <code>pr_number</code>
                        {' '}
                        - Pull request number
                      </li>
                      <li>
                        <code>pr_author</code>
                        {' '}
                        - Username of the PR author
                      </li>
                      <li>
                        <code>pr_state</code>
                        {' '}
                        - open, closed
                      </li>
                      <li>
                        <code>pr_merged</code>
                        {' '}
                        - Whether the PR is merged (true/false)
                      </li>
                      <li>
                        <code>pr_draft</code>
                        {' '}
                        - Whether the PR is a draft (true/false)
                      </li>
                      <li>
                        <code>pr_assignees</code>
                        {' '}
                        - Array of assigned usernames
                      </li>
                      <li>
                        <code>pr_requested_reviewers</code>
                        {' '}
                        - Array of requested reviewer usernames
                      </li>
                      <li>
                        <code>pr_requested_teams</code>
                        {' '}
                        - Array of requested team names
                      </li>
                      <li>
                        <code>pr_labels</code>
                        {' '}
                        - Array of label names
                      </li>
                      <li>
                        <code>pr_head_ref</code>
                        {' '}
                        - Head branch name
                      </li>
                      <li>
                        <code>pr_base_ref</code>
                        {' '}
                        - Base branch name
                      </li>
                      <li>
                        <code>current_user_is_reviewer</code>
                        {' '}
                        - Whether you are requested as reviewer (true/false)
                      </li>
                      <li>
                        <code>current_user_team_is_reviewer</code>
                        {' '}
                        - Whether your team is requested as reviewer (true/false)
                      </li>
                    </ul>

                    <p><strong>Functions:</strong></p>
                    <ul>
                      <li><code>contains(field, "text")</code> - Check if field contains substring</li>
                      <li><code>startsWith(field, "text")</code> - Check if field starts with substring</li>
                      <li><code>endsWith(field, "text")</code> - Check if field ends with substring</li>
                      <li><code>matches(field, "regex")</code> - Check if field matches regex pattern</li>
                      <li><code>includes(array_field, "value")</code> - Check if array includes value</li>
                    </ul>
                    
                    <p><strong>Examples:</strong></p>
                    <ul>
                      <li><code>reason === "review_requested"</code></li>
                      <li><code>subject_type === "PullRequest" AND reason === "mention"</code></li>
                      <li><code>repository_owner === "microsoft"</code></li>
                      <li><code>includes(pr_assignees, "username")</code></li>
                      <li><code>contains(repository_name, "react")</code></li>
                      <li><code>pr_state === "open" AND pr_draft !== true</code></li>
                      <li><code>current_user_is_reviewer OR current_user_team_is_reviewer</code></li>
                    </ul>
                  </div>
                </details>
              </div>
            </div>

            <div className="filter-templates">
              <h3>Quick Templates</h3>
              <div className="template-grid">
                {filterTemplates.map(template => (
                  <button
                    key={template.name}
                    type="button"
                    className="template-btn"
                    onClick={() => handleTemplateClick(template)}
                    title={template.description}
                  >
                    {template.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="input-group checkbox-group">
              <label>
                <input
                  type="checkbox"
                  checked={desktopNotifications}
                  onChange={e => setDesktopNotifications(e.target.checked)}
                />
                Enable desktop notifications for this inbox
              </label>
            </div>
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onCancel}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
            >
              {editingInbox ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default InboxModal
