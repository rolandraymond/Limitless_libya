import { useCallback, useEffect, useState } from 'react'
import { EMPTY_PASS_STATE, mergePassState, parsePassState, type PublicPassState } from './pass-state'

type Status = 'connecting' | 'live' | 'reconnecting' | 'offline'
export function useLivePass(token: string, initialState?: unknown) {
  const [state, setState] = useState<PublicPassState>(() => parsePassState(initialState) ?? { ...EMPTY_PASS_STATE })
  const [status, setStatus] = useState<Status>('connecting')
  const [retry, setRetry] = useState(0)
  const reconnect = useCallback(() => setRetry(value => value + 1), [])
  useEffect(() => {
    let disposed = false
    let socket: WebSocket | null = null
    let timer: ReturnType<typeof setTimeout> | undefined
    let attempts = 0
    let refreshing = false
    let revision = 0
    const controller = new AbortController()
    const apply = (value: unknown) => {
      const next = parsePassState(value)
      if (!next || disposed) return false
      setState(current => mergePassState(current, next))
      return true
    }
    // One reconciliation on returning to the page, or a manual retry. No interval.
    const reconcile = async () => {
      if (refreshing || disposed) return
      refreshing = true
      const observedRevision = revision
      try {
        const response = await fetch(`/api/check-in?token=${encodeURIComponent(token)}`, {
          cache: 'no-store', signal: controller.signal,
        })
        if (response.ok) {
          const data = await response.json()
          if (observedRevision === revision) apply(data.guest)
        }
      } catch {} finally { refreshing = false }
    }
    const connect = () => {
      if (disposed) return
      if (typeof WebSocket === 'undefined') { setStatus('offline'); return }
      const url = new URL('/api/pass/live', window.location.origin)
      url.protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      url.searchParams.set('token', token)
      setStatus(attempts ? 'reconnecting' : 'connecting')
      let current: WebSocket
      try { current = new WebSocket(url) }
      catch { setStatus('offline'); return }
      socket = current
      current.onmessage = event => {
        if (disposed || socket !== current) return
        try {
          const message = JSON.parse(event.data)
          if (message.type === 'pass-state' && apply(message.state)) {
            revision++
            attempts = 0
            setStatus('live')
          }
        } catch {}
      }
      current.onerror = () => { try { current.close() } catch {} }
      current.onclose = event => {
        if (disposed || socket !== current) return
        socket = null
        if (event.code === 1008 || ++attempts > 6) { setStatus('offline'); return }
        setStatus('reconnecting')
        // Retry the connection only after a disconnect. This is not polling D1.
        timer = setTimeout(connect, Math.min(1000 * 2 ** (attempts - 1), 30000) + Math.random() * 250)
      }
    }
    const focus = () => {
      if (document.hidden || disposed) return
      void reconcile()
      if (!socket || socket.readyState >= 2) {
        clearTimeout(timer)
        attempts = 0
        connect()
      }
    }
    if (retry) void reconcile()
    connect()
    window.addEventListener('focus', focus)
    document.addEventListener('visibilitychange', focus)
    return () => {
      disposed = true
      clearTimeout(timer)
      controller.abort()
      window.removeEventListener('focus', focus)
      document.removeEventListener('visibilitychange', focus)
      if (socket) { try { socket.onclose = null; socket.close(1000, 'Pass closed.') } catch {} }
    }
  }, [token, retry])
  return { state, status, reconnect }
}
