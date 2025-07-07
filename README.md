# Peeper - GitHub Notifications

A desktop application for managing GitHub notifications with advanced filtering and organization capabilities.

## Overview

Peeper is an Electron-based desktop application that provides a powerful interface for managing your GitHub notifications. It allows you to organize notifications into custom inboxes with sophisticated filtering capabilities, ensuring you never miss important updates while keeping your workflow organized.

## Key Features

### 🔔 **Smart Notification Management**
- **Automatic Sync**: Configurable background synchronization with GitHub (1 minute to 1 hour intervals)
- **Desktop Notifications**: Optional system notifications for new GitHub notifications
- **Unread Tracking**: Keep track of read/unread status across all your notifications
- **Mark as Done**: Additional workflow state to help manage completed items

### 📬 **Custom Inboxes**
- **Flexible Filtering**: Create custom inboxes using powerful filter expressions
- **Filter Templates**: Pre-built templates for common notification types (Pull Requests, Issues, Mentions, etc.)
- **Desktop Notifications Per Inbox**: Enable/disable desktop notifications for each inbox individually
- **Quick Filter Templates**: Common filters like "Pull Requests", "Review Requests", "Mentions", and more

### 🎯 **Advanced Filtering System**
- **Rich Filter Language**: Support for complex boolean expressions with AND/OR operators
- **Multiple Field Support**: Filter by repository, author, subject type, reason, and more
- **Available Filter Fields**:

#### Basic Notification Fields
  - `subject_title` - Title of the notification subject
  - `subject_type` - Type: Issue, PullRequest, Release, Commit, Discussion, etc.
  - `repository_name` - Repository name only
  - `repository_owner` - Repository owner username
  - `repository_full_name` - Full repository name (owner/repo)
  - `reason` - Notification reason: assign, author, comment, mention, review_requested, team_mention, etc.
  - `unread` - Whether notification is unread (true/false)
  - `updated_at` - When the notification was last updated
  - `done` - User-defined workflow state (true/false)

#### Pull Request Specific Fields
  - `pr_number` - Pull request number
  - `pr_author` - Username of the pull request author
  - `pr_state` - Pull request state: open, closed
  - `pr_merged` - Whether the pull request is merged (true/false)
  - `pr_draft` - Whether the pull request is a draft (true/false)
  - `pr_assignees` - JSON array of usernames assigned to the PR
  - `pr_requested_reviewers` - JSON array of usernames requested as reviewers
  - `pr_requested_teams` - JSON array of team names requested as reviewers
  - `pr_labels` - JSON array of label names on the PR
  - `pr_head_ref` - Head branch name of the PR
  - `pr_base_ref` - Base branch name of the PR
  - `pr_head_repo` - Full name of the head repository
  - `pr_base_repo` - Full name of the base repository

#### User Context Fields
  - `current_user_is_reviewer` - Whether you are requested as a reviewer (true/false)
  - `current_user_team_is_reviewer` - Whether one of your teams is requested as reviewer (true/false)

#### Available Functions
  - `contains(field, "text")` - Check if field contains substring
  - `startsWith(field, "text")` - Check if field starts with substring
  - `endsWith(field, "text")` - Check if field ends with substring
  - `matches(field, "regex")` - Check if field matches regex pattern
  - `includes(array_field, "value")` - Check if array field includes value (for PR arrays)

#### Supported Operators
  - `===` or `==` - Equality comparison
  - `!==` or `!=` - Inequality comparison
  - `>`, `>=`, `<`, `<=` - Numeric comparisons
  - `AND` or `&&` - Logical AND
  - `OR` or `||` - Logical OR
  - `NOT` or `!` - Logical NOT

### ⚡ **Quick Filters**
- **Hide Read Notifications**: Quickly filter out already read items
- **Hide Merged PRs**: Remove merged pull requests from view
- **Hide Draft PRs**: Filter out draft pull requests
- **Hide Done Items**: Remove completed items from view
- **Per-Inbox Configuration**: Each inbox can have its own quick filter settings

### 🎨 **User Experience**
- **Modern UI**: Clean, GitHub-inspired dark theme interface
- **Pagination**: Efficient loading of large notification lists
- **Context Menus**: Right-click to edit or delete inboxes
- **Keyboard Shortcuts**: Efficient navigation and management
- **Responsive Design**: Optimized for various screen sizes

### 🔧 **Configuration & Preferences**
- **Auto-Sync Settings**: Enable/disable automatic synchronization
- **Sync Intervals**: Choose from 1 minute to 1 hour sync intervals
- **Desktop Notifications**: Global toggle for system notifications
- **Sound Notifications**: Optional notification sounds
- **GitHub Token Management**: Secure token storage and validation

## Installation

1. Download the latest release for your platform
2. Install the application following your operating system's standard procedure
3. Launch Peeper and provide your GitHub Personal Access Token

## GitHub Token Setup

1. Go to GitHub → Settings → Developer settings → Personal access tokens
2. Generate a new token with the following permissions:
   - `notifications` - Read and write access to notifications
   - `repo` - Repository access (for private repositories)
3. Copy the token and paste it into Peeper when prompted

## Usage

### Creating Your First Inbox

1. Click "Add Inbox" in the sidebar
2. Give your inbox a descriptive name
3. Create a filter expression (or use a template)
4. Optionally enable desktop notifications for this inbox
5. Click "Create" to save

### Example Filter Expressions

```javascript
// All pull request notifications
subject_type === "PullRequest"

// Pull requests where you're requested to review
reason === "review_requested"

// Mentions in a specific repository
reason === "mention" AND repository_full_name === "microsoft/vscode"

// Open pull requests assigned to you
subject_type === "PullRequest" AND pr_state === "open" AND reason === "assign"

// All notifications except drafts
subject_type !== "PullRequest" OR pr_draft !== true

// Pull requests from a specific author
subject_type === "PullRequest" AND pr_author === "octocat"

// Pull requests assigned to a specific user
subject_type === "PullRequest" AND includes(pr_assignees, "username")

// Pull requests where you or your team are reviewing
subject_type === "PullRequest" AND (current_user_is_reviewer OR current_user_team_is_reviewer)

// Issues with specific labels
subject_type === "Issue" AND includes(pr_labels, "bug")

// Notifications from repositories containing "react"
contains(repository_name, "react")

// Pull requests targeting main branch
subject_type === "PullRequest" AND pr_base_ref === "main"

// Unread notifications that aren't done
unread === true AND done !== true
```

### Managing Notifications

- **Mark as Read**: Click on individual notifications to mark them as read
- **Mark as Done**: Use the workflow state to track completed items
- **Quick Filters**: Use the filter dropdown to quickly hide read, merged, or draft items
- **Sync**: Click the sync button to manually fetch new notifications

## Technical Details

- **Built with**: Electron, React, TypeScript, and Vite
- **Database**: SQLite for local storage
- **GitHub API**: Uses GitHub's REST API for notification fetching
- **Auto-Updates**: Built-in update system for seamless upgrades

## Development

This is a multi-package workspace built with:
- **Main Process**: Electron main process (Node.js)
- **Renderer Process**: React frontend with TypeScript
- **Preload Script**: Secure bridge between main and renderer

### Build Scripts

```bash
npm run build      # Build all packages
npm run dev        # Start development server
npm run compile    # Create distributable packages
npm run test       # Run tests
```

## License

Licensed under the Apache License 2.0. See LICENSE file for details.
