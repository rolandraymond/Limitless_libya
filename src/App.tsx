import PassPage from './PassPage'
import LibyaHome from './LibyaHome'
import CheckInPage from './CheckInPage'
import AdminPage from './AdminPage'

export default function App() {
  const path = window.location.pathname
  if (path === '/pass') return <PassPage />
  if (path === '/admin') return <AdminPage />
  if (path === '/check-in') return <CheckInPage />
  // Legacy /register links now lead back to the registration section in Libya.
  if (path === '/register' || path === '/register/') {
    window.location.replace('/#rsvp')
    return null
  }
  if (path === '/') return <LibyaHome />
  return <main><h1>Page not found</h1><a href="/">Back to home</a></main>
}