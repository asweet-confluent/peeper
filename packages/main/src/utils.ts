import {  shell } from 'electron'

/**
 * Utility functions for GitHub URL conversions
 */

/**
 * Convert GitHub API URLs to web URLs
 * Example: https://api.github.com/repos/owner/repo/pulls/123 -> https://github.com/owner/repo/pull/123
 */
export function convertApiUrlToWebUrl(apiUrl: string | null): string | null {
  if (!apiUrl)
    return null

  try {
    // Handle pull request URLs
    const prMatch = apiUrl.match(/https:\/\/api\.github\.com\/repos\/([^/]+)\/([^/]+)\/pulls\/(\d+)/)
    if (prMatch) {
      const [, owner, repo, prNumber] = prMatch
      return `https://github.com/${owner}/${repo}/pull/${prNumber}`
    }

    // Handle issue URLs
    const issueMatch = apiUrl.match(/https:\/\/api\.github\.com\/repos\/([^/]+)\/([^/]+)\/issues\/(\d+)/)
    if (issueMatch) {
      const [, owner, repo, issueNumber] = issueMatch
      return `https://github.com/${owner}/${repo}/issues/${issueNumber}`
    }

    // Handle commit URLs
    const commitMatch = apiUrl.match(/https:\/\/api\.github\.com\/repos\/([^/]+)\/([^/]+)\/commits\/([a-f0-9]+)/)
    if (commitMatch) {
      const [, owner, repo, sha] = commitMatch
      return `https://github.com/${owner}/${repo}/commit/${sha}`
    }

    // Handle release URLs
    const releaseMatch = apiUrl.match(/https:\/\/api\.github\.com\/repos\/([^/]+)\/([^/]+)\/releases\/(\d+)/)
    if (releaseMatch) {
      const [, owner, repo, _releaseId] = releaseMatch
      // For releases, we'll need to get the tag name, but for now return the releases page
      return `https://github.com/${owner}/${repo}/releases`
    }

    // If no pattern matches, return the original URL (fallback)
    return apiUrl
  }
  catch (error) {
    console.warn('Failed to convert API URL to web URL:', apiUrl, error)
    return apiUrl
  }
}

export async function openExternal(_event: Electron.IpcMainInvokeEvent, url: string) {
  try {
    await shell.openExternal(url)
  }
  catch (error) {
    console.error('Failed to open URL:', error)
  }
}

export function consoleOutput(_event: Electron.IpcMainInvokeEvent, level: string, ...args: any[]) {
  const timestamp = new Date().toISOString()
  const prefix = `[RENDERER ${timestamp}]`

  // Format arguments for terminal output
  const formattedArgs = args.map((arg) => {
    if (typeof arg === 'object' && arg !== null) {
      try {
        return JSON.stringify(arg, null, 2)
      }
      catch {
        return String(arg)
      }
    }
    return String(arg)
  }).join(' ')

  // Output to terminal stdout with appropriate formatting
  switch (level) {
    case 'error':
      console.error(`${prefix} [ERROR]`, formattedArgs)
      break
    case 'warn':
      console.warn(`${prefix} [WARN]`, formattedArgs)
      break
    case 'info':
      console.info(`${prefix} [INFO]`, formattedArgs)
      break
    case 'debug':
      console.debug(`${prefix} [DEBUG]`, formattedArgs)
      break
    default:
      console.log(`${prefix} [LOG]`, formattedArgs)
  }
}
