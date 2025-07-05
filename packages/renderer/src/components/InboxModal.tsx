import type { Inbox } from '../../../preload/src/types.js'
import React, { useEffect, useState } from 'react'
import FilterAutocomplete from './FilterAutocomplete.js'

interface InboxModalProps {
  inbox: Inbox | null
  onSave: (inbox: Inbox) => void
  onCancel: () => void
}

const InboxModal: React.FC<InboxModalProps> = ({
  inbox,
  onSave,
  onCancel,
}) => {
  const [name, setName] = useState('')
  const [filterExpression, setFilterExpression] = useState('')
  const [desktopNotifications, setDesktopNotifications] = useState(false)

  useEffect(() => {
    if (inbox) {
      setName(inbox.name)
      setFilterExpression(inbox.filter_expression)
      setDesktopNotifications(!!inbox.desktop_notifications)
    }
    else {
      setName('')
      setFilterExpression('')
      setDesktopNotifications(false)
    }
  }, [inbox])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!name.trim() || !filterExpression.trim()) {
      return
    }

    const newInbox: Inbox = {
      ...(inbox || {}),
      name: name.trim(),
      filter_expression: filterExpression.trim(),
      desktop_notifications: desktopNotifications ? 1 : 0,
    }

    onSave(newInbox)
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
          <h2>{inbox ? 'Edit Inbox' : 'Create Inbox'}</h2>
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
              />
              <div className="filter-help">
                <details>
                  <summary>Available fields and examples</summary>
                  <div className="filter-help-content">
                    <p><strong>Available fields:</strong></p>
                    <ul>
                      <li>
                        <code>reason</code>
                        {' '}
                        - assign, author, comment, mention, review_requested, etc.
                      </li>
                      <li>
                        <code>subject_type</code>
                        {' '}
                        - PullRequest, Issue, Release, etc.
                      </li>
                      <li>
                        <code>repository_name</code>
                        {' '}
                        - Repository name
                      </li>
                      <li>
                        <code>repository_owner</code>
                        {' '}
                        - Repository owner
                      </li>
                      <li>
                        <code>subject_title</code>
                        {' '}
                        - Notification title
                      </li>
                    </ul>
                    <p><strong>Examples:</strong></p>
                    <ul>
                      <li><code>reason === "review_requested"</code></li>
                      <li><code>subject_type === "PullRequest" AND reason === "mention"</code></li>
                      <li><code>repository_owner === "microsoft"</code></li>
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
              {inbox ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default InboxModal
