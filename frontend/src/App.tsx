import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { Box } from '@mui/material';

import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Navbar } from './components/layout/Navbar';
import { Dashboard } from './pages/Dashboard';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { StoryCreation } from './pages/StoryCreation';
import { StoryEditor } from './pages/StoryEditor';
import { Settings } from './pages/Settings';
import { NotFound } from './pages/NotFound';

function App() {
  return (
    <AuthProvider>
      <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          
          {/* Protected routes */}
          <Route path="/" element={
            <ProtectedRoute>
              <Navbar />
              <Box component="main" sx={{ flexGrow: 1 }}>
                <Dashboard />
              </Box>
            </ProtectedRoute>
          } />
          
          <Route path="/dashboard" element={
            <ProtectedRoute>
              <Navbar />
              <Box component="main" sx={{ flexGrow: 1 }}>
                <Dashboard />
              </Box>
            </ProtectedRoute>
          } />
          
          <Route path="/create" element={
            <ProtectedRoute>
              <Navbar />
              <Box component="main" sx={{ flexGrow: 1 }}>
                <StoryCreation />
              </Box>
            </ProtectedRoute>
          } />
          
          <Route path="/stories/:storyId/edit" element={
            <ProtectedRoute>
              <Navbar />
              <Box component="main" sx={{ flexGrow: 1 }}>
                <StoryEditor />
              </Box>
            </ProtectedRoute>
          } />
          
          <Route path="/settings" element={
            <ProtectedRoute>
              <Navbar />
              <Box component="main" sx={{ flexGrow: 1 }}>
                <Settings />
              </Box>
            </ProtectedRoute>
          } />
          
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Box>
    </AuthProvider>
  );
}

export default App;