import React from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  Box,
  IconButton,
} from '@mui/material';
import {
  Create as CreateIcon,
  Dashboard as DashboardIcon,
  Settings as SettingsIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

export function Navbar() {
  const navigate = useNavigate();

  return (
    <AppBar position="static" elevation={0}>
      <Toolbar>
        <Typography 
          variant="h6" 
          component="div" 
          sx={{ 
            flexGrow: 1, 
            fontWeight: 600,
            cursor: 'pointer'
          }}
          onClick={() => navigate('/')}
        >
          StoryForge AI
        </Typography>
        
        <Box sx={{ display: { xs: 'none', md: 'flex' }, gap: 1 }}>
          <Button
            color="inherit"
            startIcon={<DashboardIcon />}
            onClick={() => navigate('/dashboard')}
          >
            Dashboard
          </Button>
          <Button
            color="inherit"
            startIcon={<CreateIcon />}
            onClick={() => navigate('/create')}
          >
            Create Story
          </Button>
          <Button
            color="inherit"
            startIcon={<SettingsIcon />}
            onClick={() => navigate('/settings')}
          >
            Settings
          </Button>
        </Box>

        <Box sx={{ display: { xs: 'flex', md: 'none' } }}>
          <IconButton
            color="inherit"
            onClick={() => navigate('/dashboard')}
            title="Dashboard"
          >
            <DashboardIcon />
          </IconButton>
          <IconButton
            color="inherit"
            onClick={() => navigate('/create')}
            title="Create Story"
          >
            <CreateIcon />
          </IconButton>
          <IconButton
            color="inherit"
            onClick={() => navigate('/settings')}
            title="Settings"
          >
            <SettingsIcon />
          </IconButton>
        </Box>
      </Toolbar>
    </AppBar>
  );
}