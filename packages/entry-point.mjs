import process from 'node:process'
import { fileURLToPath } from 'node:url'

// Use relative path during development
let initApp
if (process.env.NODE_ENV === 'development') {
  const { initApp: devInitApp } = await import('./main/dist/index.js')
  initApp = devInitApp
} else {
  const { initApp: prodInitApp } = await import('@app/main')
  initApp = prodInitApp
}

if (process.env.NODE_ENV === 'development' || process.env.PLAYWRIGHT_TEST === 'true' || !!process.env.CI) {
  function showAndExit(...args) {
    console.error(...args)
    process.exit(1)
  }

  process.on('uncaughtException', showAndExit)
  process.on('unhandledRejection', showAndExit)
}

/**
 * We resolve '@app/renderer' and '@app/preload'
 * here and not in '@app/main'
 * to observe good practices of modular design.
 * This allows fewer dependencies and better separation of concerns in '@app/main'.
 * Thus,
 * the main module remains simplistic and efficient
 * as it receives initialization instructions rather than direct module imports.
 */
initApp(
  {
    renderer: (process.env.MODE === 'development' && !!process.env.VITE_DEV_SERVER_URL)
      ? new URL(process.env.VITE_DEV_SERVER_URL)
      : process.env.NODE_ENV === 'development'
        ? {
            path: fileURLToPath(new URL('./renderer/dist/index.html', import.meta.url)),
          }
        : {
            path: fileURLToPath(import.meta.resolve('@app/renderer')),
          },
    preload: {
      path: process.env.NODE_ENV === 'development'
        ? fileURLToPath(new URL('./preload/dist/exposed.mjs', import.meta.url))
        : fileURLToPath(import.meta.resolve('@app/preload/exposed.mjs')),
    },
  },
).catch(error => {
  console.error('App initialization failed:', error)
  process.exit(1)
})
