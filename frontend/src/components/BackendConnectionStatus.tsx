import { useEffect, useState } from 'react'
import { checkBackendHealth, getApiBaseUrl } from '../api'

export default function BackendConnectionStatus() {
  const [isConnected, setIsConnected] = useState<boolean | null>(null)
  const [error, setError] = useState<string>('')
  const apiUrl = getApiBaseUrl()

  useEffect(() => {
    const checkConnection = async () => {
      try {
        const isHealthy = await checkBackendHealth()
        setIsConnected(isHealthy)
        if (!isHealthy) {
          setError(`Backend at ${apiUrl} is not responding`)
        }
      } catch (err) {
        setIsConnected(false)
        setError(`Cannot reach backend at ${apiUrl}`)
      }
    }

    checkConnection()
    const interval = setInterval(checkConnection, 30000) // Check every 30 seconds

    return () => clearInterval(interval)
  }, [apiUrl])

  if (isConnected === null) {
    return (
      <div style={{ padding: '8px 12px', fontSize: '12px', backgroundColor: '#f5f5f5', borderRadius: '4px' }}>
        Checking backend connection...
      </div>
    )
  }

  if (isConnected) {
    return (
      <div style={{ padding: '8px 12px', fontSize: '12px', backgroundColor: '#d4edda', color: '#155724', borderRadius: '4px' }}>
        ✓ Connected to backend at {apiUrl}
      </div>
    )
  }

  return (
    <div style={{ padding: '8px 12px', fontSize: '12px', backgroundColor: '#f8d7da', color: '#721c24', borderRadius: '4px' }}>
      ✗ {error}
    </div>
  )
}
