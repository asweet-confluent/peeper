import React, { useEffect, useState } from 'react'
import './App.css'
import MainApp from './components/MainApp.tsx'
import SetupScreen from './components/SetupScreen.tsx'

const App: React.FC = () => {
  const [hasToken, setHasToken] = useState<boolean | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const checkToken = async () => {
      try {
        // Wait for api.invoke to be available
        if (!window.api.invoke) {
          console.warn('api.invoke not yet available, waiting...')
          // Wait a bit and try again
          setTimeout(checkToken, 100)
          return
        }

        const token = await window.api.invoke.getToken()
        if (token) {
          // Test token to make sure it's still valid
          const result = await window.api.invoke.testToken(token)
          setHasToken(result.success)
        }
        else {
          setHasToken(false)
        }
      }
      catch (error) {
        console.error('Error checking token:', error)
        setHasToken(false)
      }
      finally {
        setIsLoading(false)
      }
    }

    checkToken()
  }, [])

  const handleTokenSaved = () => {
    setHasToken(true)
  }

  if (isLoading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
        Loading...
      </div>
    )
  }

  return hasToken
    ? (
        <MainApp />
      )
    : (
        <SetupScreen onTokenSaved={handleTokenSaved} />
      )
}

export default App
