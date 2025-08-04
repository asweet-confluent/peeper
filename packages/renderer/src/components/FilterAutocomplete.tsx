import type { AutocompleteItem } from '../../../preload/src/types.js'
import React, { useEffect, useRef, useState } from 'react'

interface AutocompleteProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  rows?: number
  required?: boolean
}

const FilterAutocomplete: React.FC<AutocompleteProps> = ({
  value,
  onChange,
  placeholder,
  rows = 3,
  required = false
}) => {
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [suggestions, setSuggestions] = useState<AutocompleteItem[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [cursorPosition, setCursorPosition] = useState(0)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const suggestionsRef = useRef<HTMLDivElement>(null)

  // Debouncing for user search API calls
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastSearchTimeRef = useRef<number>(0)
  const DEBOUNCE_DELAY = 1000 // 1 second

  const fields = [
    { name: 'id', description: 'Notification ID' },
    { name: 'subject_title', description: 'Title of the notification subject' },
    { name: 'subject_type', description: 'Type: Issue, PullRequest, Commit, etc.' },
    { name: 'repository_name', description: 'Repository name' },
    { name: 'repository_full_name', description: 'Full repository name (owner/repo)' },
    { name: 'repository_owner', description: 'Repository owner username' },
    { name: 'reason', description: 'Reason: subscribed, mention, review_requested, etc.' },
    { name: 'unread', description: 'Whether notification is unread (true/false)' },
    { name: 'updated_at', description: 'When the notification was last updated' },
    // Pull Request fields
    { name: 'pr_number', description: 'Pull request number' },
    { name: 'pr_author', description: 'Username of the pull request author' },
    { name: 'pr_state', description: 'Pull request state: open, closed' },
    { name: 'pr_merged', description: 'Whether the pull request is merged (true/false)' },
    { name: 'pr_draft', description: 'Whether the pull request is a draft (true/false)' },
    { name: 'pr_assignees', description: 'Array of usernames assigned to the PR' },
    { name: 'pr_requested_reviewers', description: 'Array of usernames requested as reviewers' },
    { name: 'pr_requested_teams', description: 'Array of team names requested as reviewers' },
    { name: 'pr_labels', description: 'Array of label names on the PR' },
    { name: 'pr_head_ref', description: 'Head branch name of the PR' },
    { name: 'pr_base_ref', description: 'Base branch name of the PR' },
    { name: 'pr_head_repo', description: 'Full name of the head repository' },
    { name: 'pr_base_repo', description: 'Full name of the base repository' },
    { name: 'current_user_is_reviewer', description: 'Whether you are requested as a reviewer (true/false)' },
    { name: 'current_user_team_is_reviewer', description: 'Whether one of your teams is requested as reviewer (true/false)' },
  ]

  const operators = [
    { name: '==', description: 'Equality' },
    { name: '!=', description: 'Inequality' },
    { name: 'AND', description: 'Logical AND' },
    { name: 'OR', description: 'Logical OR' },
    { name: 'NOT', description: 'Logical NOT' },
  ]

  const valueSuggestions: { [key: string]: string[] } = {
    subject_type: ['Issue', 'PullRequest', 'Commit', 'Release', 'Discussion'],
    reason: ['subscribed', 'mention', 'review_requested', 'assign', 'author', 'comment', 'invitation', 'manual', 'team_mention'],
    unread: ['true', 'false'],
    pr_state: ['open', 'closed'],
    pr_merged: ['true', 'false'],
    pr_draft: ['true', 'false'],
    current_user_is_reviewer: ['true', 'false'],
    current_user_team_is_reviewer: ['true', 'false'],
    pr_base_ref: ['main', 'master', 'develop', 'dev'],
    pr_head_ref: ['feature/', 'fix/', 'hotfix/', 'chore/'],
  }

  const functions = [
    { name: 'contains(', description: 'Check if string contains substring' },
    { name: 'equals(', description: 'Check if strings are exactly equal' },
    { name: 'startsWith(', description: 'Check if string starts with substring' },
    { name: 'endsWith(', description: 'Check if string ends with substring' },
    { name: 'matches(', description: 'Check if string matches regex pattern' },
    { name: 'includes(', description: 'Check if array includes a value' },
  ]

  const keywords = [
    { name: 'true', description: 'Boolean true value' },
    { name: 'false', description: 'Boolean false value' },
    { name: 'AND', description: 'Logical AND operator' },
    { name: 'OR', description: 'Logical OR operator' },
    { name: 'NOT', description: 'Logical NOT operator' },
  ]

  // Debounced search function for username API calls
  const debouncedSearchUsers = (searchTerm: string): Promise<string[]> => {
    return new Promise((resolve) => {
      // Clear any existing timeout
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current)
      }

      // Check if enough time has passed since last search
      const now = Date.now()
      const timeSinceLastSearch = now - lastSearchTimeRef.current

      if (timeSinceLastSearch >= DEBOUNCE_DELAY) {
        // Enough time has passed, make the API call immediately
        lastSearchTimeRef.current = now
        window.api.invoke.searchUsers(searchTerm, 8)
          .then(resolve)
          .catch(() => resolve([]))
      }
      else {
        // Not enough time has passed, schedule the API call
        const remainingDelay = DEBOUNCE_DELAY - timeSinceLastSearch
        debounceTimeoutRef.current = setTimeout(() => {
          lastSearchTimeRef.current = Date.now()
          window.api.invoke.searchUsers(searchTerm, 8)
            .then(resolve)
            .catch(() => resolve([]))
        }, remainingDelay)
      }
    })
  }

  const getSuggestions = async (text: string, cursorPos: number): Promise<AutocompleteItem[]> => {
    const beforeCursor = text.substring(0, cursorPos)
    const words = beforeCursor.split(/\s+/)
    const currentWord = words[words.length - 1] || ''

    const suggestions: AutocompleteItem[] = []

    // Check if we should provide username suggestions
    const shouldProvideUsernameSuggestions = () => {
      // Look for patterns like: field_name == "partial_username or field_name == "
      // We need to find the field name and check if it's a username field
      const usernameFields = ['pr_author', 'pr_assignees', 'pr_requested_reviewers', 'repository_owner']

      // Find the most recent field name mentioned before a comparison operator
      const fieldPattern = /(\w+)\s*(==|!=)\s*"([^"]*)$/
      const match = beforeCursor.match(fieldPattern)

      if (match) {
        const fieldName = match[1]
        const quotedValue = match[3] || '' // This might be undefined if user just typed "

        // Check if this is a username field and we're inside quotes
        if (usernameFields.includes(fieldName)) {
          return quotedValue // Return the partial username to search for
        }
      }

      return null
    }

    const usernameSearchTerm = shouldProvideUsernameSuggestions()

    if (usernameSearchTerm !== null) {
      // We're in a username field within quotes - provide username suggestions
      try {
        if (usernameSearchTerm.length >= 1) { // Start suggesting after 1 character
          const usernames = await debouncedSearchUsers(usernameSearchTerm)
          usernames.forEach((username: string) => {
            suggestions.push({
              text: username, // Don't add quotes - user is already in quotes
              type: 'username',
              description: `GitHub username: ${username}`,
            })
          })
        }
        else {
          // If no search term yet, try to get some common usernames from notifications
          try {
            const commonUsernames = await window.api.invoke.getUniqueUsernames()
            commonUsernames.slice(0, 5).forEach((username: string) => {
              suggestions.push({
                text: username,
                type: 'username',
                description: `Username from your notifications: ${username}`,
              })
            })
          }
          catch {
            // Ignore errors for fallback suggestions
          }
        }
      }
      catch {
        // Ignore errors for dynamic suggestions
      }
    }
    else if (currentWord.length > 0) {
      // Normal autocompletion for fields, operators, functions, keywords
      const searchTerm = currentWord.toLowerCase()

      // Add matching fields (prioritize exact matches, then includes)
      const fieldMatches: AutocompleteItem[] = []
      const fieldPartialMatches: AutocompleteItem[] = []

      fields.forEach((field) => {
        const fieldName = field.name.toLowerCase()
        if (fieldName.startsWith(searchTerm)) {
          fieldMatches.push({
            text: field.name,
            type: 'field',
            description: field.description,
          })
        }
        else if (fieldName.includes(searchTerm)) {
          fieldPartialMatches.push({
            text: field.name,
            type: 'field',
            description: field.description,
          })
        }
      })

      suggestions.push(...fieldMatches, ...fieldPartialMatches)

      // Add matching operators
      operators.forEach((op) => {
        if (op.name.toLowerCase().includes(searchTerm)) {
          suggestions.push({
            text: op.name,
            type: 'operator',
            description: op.description,
          })
        }
      })

      // Add matching functions
      functions.forEach((func) => {
        if (func.name.toLowerCase().includes(searchTerm)) {
          suggestions.push({
            text: func.name,
            type: 'function',
            description: func.description,
          })
        }
      })

      // Add matching keywords
      keywords.forEach((keyword) => {
        if (keyword.name.toLowerCase().includes(searchTerm)) {
          suggestions.push({
            text: keyword.name,
            type: 'keyword',
            description: keyword.description,
          })
        }
      })

      // Add value suggestions for known fields
      const lastFieldMatch = beforeCursor.match(/(\w+)\s*(==|!=)\s*"?(\w*)$/)
      if (lastFieldMatch) {
        const fieldName = lastFieldMatch[1]
        if (valueSuggestions[fieldName]) {
          valueSuggestions[fieldName].forEach((value) => {
            if (value.toLowerCase().includes(searchTerm)) {
              suggestions.push({
                text: `"${value}"`,
                type: 'value',
                description: `Suggested value for ${fieldName}`,
              })
            }
          })
        }
      }
    }

    return suggestions.slice(0, 10) // Limit to 10 suggestions
  }

  const handleInputChange = async (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value
    const cursorPos = e.target.selectionStart || 0

    onChange(newValue)
    setCursorPosition(cursorPos)

    if (newValue.length > 0) {
      const newSuggestions = await getSuggestions(newValue, cursorPos)
      setSuggestions(newSuggestions)
      setShowSuggestions(newSuggestions.length > 0)
      setSelectedIndex(0)
    }
    else {
      setShowSuggestions(false)
    }
  }

  const insertSuggestion = (suggestion: AutocompleteItem) => {
    if (!textareaRef.current)
      return

    const textarea = textareaRef.current
    const beforeCursor = value.substring(0, cursorPosition)
    const afterCursor = value.substring(cursorPosition)

    // Special handling for username suggestions within quotes
    if (suggestion.type === 'username') {
      // Check if we're currently inside quotes for a username field
      const fieldPattern = /(\w+)\s*(==|!=)\s*"([^"]*)$/
      const match = beforeCursor.match(fieldPattern)
      
      if (match) {
        const fieldName = match[1]
        const operator = match[2]
        const partialValue = match[3] || ''
        
        // Replace just the partial username within the quotes
        const beforeQuote = beforeCursor.substring(0, beforeCursor.lastIndexOf('"') + 1)
        const newValue = beforeQuote + suggestion.text + '"' + afterCursor
        
        onChange(newValue)
        setShowSuggestions(false)
        
        // Set cursor position after the inserted username but before the closing quote
        const newCursorPos = beforeQuote.length + suggestion.text.length
        setTimeout(() => {
          textarea.focus()
          textarea.setSelectionRange(newCursorPos, newCursorPos)
        }, 0)
        return
      }
    }

    // Default behavior for other suggestions
    const words = beforeCursor.split(/\s+/)
    const currentWord = words[words.length - 1] || ''

    // Replace the current word with the suggestion
    const beforeCurrentWord = beforeCursor.substring(0, beforeCursor.length - currentWord.length)
    const newValue = beforeCurrentWord + suggestion.text + afterCursor

    onChange(newValue)
    setShowSuggestions(false)

    // Set cursor position after the inserted text
    const newCursorPos = beforeCurrentWord.length + suggestion.text.length
    setTimeout(() => {
      textarea.focus()
      textarea.setSelectionRange(newCursorPos, newCursorPos)
    }, 0)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!showSuggestions)
      return

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex(prev => Math.min(prev + 1, suggestions.length - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex(prev => Math.max(prev - 1, 0))
        break
      case 'Enter':
      case 'Tab':
        if (suggestions[selectedIndex]) {
          e.preventDefault()
          insertSuggestion(suggestions[selectedIndex])
        }
        break
      case 'Escape':
        e.preventDefault()
        setShowSuggestions(false)
        break
    }
  }

  const handleSuggestionClick = (suggestion: AutocompleteItem) => {
    insertSuggestion(suggestion)
  }

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionsRef.current
        && !suggestionsRef.current.contains(event.target as Node)
        && textareaRef.current
        && !textareaRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      // Clean up debounce timeout on unmount
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current)
      }
    }
  }, [])

  return (
    <div className="filter-autocomplete">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        rows={rows}
        className="filter-input"
        required={required}
      />

      {showSuggestions && suggestions.length > 0 && (
        <div ref={suggestionsRef} className="autocomplete-dropdown">
          {suggestions.map((suggestion, index) => (
            <div
              key={`${suggestion.type}-${suggestion.text}`}
              className={`autocomplete-item ${index === selectedIndex ? 'selected' : ''}`}
              onClick={() => handleSuggestionClick(suggestion)}
              onMouseEnter={() => setSelectedIndex(index)}
            >
              <div className="autocomplete-item-content">
                <span className={`autocomplete-type autocomplete-type-${suggestion.type}`}>
                  {suggestion.type}
                </span>
                <span className="autocomplete-text">{suggestion.text}</span>
              </div>
              {suggestion.description && (
                <div className="autocomplete-description">{suggestion.description}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default FilterAutocomplete
