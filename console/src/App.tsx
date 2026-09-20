import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext'
import AdminRoute from './components/AdminRoute'
import AppLayout from './components/AppLayout'
import RequireAuth from './components/RequireAuth'
import Audit from './pages/Audit'
import Devices from './pages/Devices'
import Login from './pages/Login'
import Overview from './pages/Overview'
import Profile from './pages/Profile'
import Settings from './pages/Settings'
import Users from './pages/Users'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            element={
              <RequireAuth>
                <AppLayout />
              </RequireAuth>
            }
          >
            <Route path="/" element={<Overview />} />
            <Route path="/devices" element={<Devices />} />
            <Route
              path="/users"
              element={
                <AdminRoute>
                  <Users />
                </AdminRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <AdminRoute>
                  <Settings />
                </AdminRoute>
              }
            />
            <Route
              path="/audit"
              element={
                <AdminRoute>
                  <Audit />
                </AdminRoute>
              }
            />
            <Route path="/profile" element={<Profile />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
