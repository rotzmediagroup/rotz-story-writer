import React, { useState } from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  Box,
  IconButton,
  Avatar,
  Menu,
  MenuItem,
  Divider,
  ListItemIcon,
  Chip,
  Badge,
} from '@mui/material';
import {
  Create as CreateIcon,
  Dashboard as DashboardIcon,
  Settings as SettingsIcon,
  AccountCircle,
  Logout,
  Person,
  Star,
  AutoStories,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

export function Navbar() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    logout();
    handleMenuClose();
    navigate('/login');
  };

  const getAvatarContent = () => {
    if (user?.name) {
      return user.name.charAt(0).toUpperCase();
    }
    return <AccountCircle />;
  };

  const getSubscriptionColor = (tier: string) => {
    switch (tier) {
      case 'premium': return 'warning';
      case 'enterprise': return 'success';
      default: return 'default';
    }
  };

  return (
    <AppBar position="static" elevation={0}>
      <Toolbar>
        <Box sx={{ display: 'flex', alignItems: 'center', flexGrow: 1 }}>
          <AutoStories sx={{ mr: 1 }} />
          <Typography 
            variant="h6" 
            component="div" 
            sx={{ 
              fontWeight: 600,
              cursor: 'pointer'
            }}
            onClick={() => navigate('/')}
          >
            AI Story Writer
          </Typography>
        </Box>
        
        <Box sx={{ display: { xs: 'none', md: 'flex' }, gap: 1, mr: 2 }}>
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

        <Box sx={{ display: { xs: 'flex', md: 'none' }, mr: 2 }}>
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

        {/* User Account Menu */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {user?.subscriptionTier && (
            <Chip 
              label={user.subscriptionTier.toUpperCase()}
              size="small"
              color={getSubscriptionColor(user.subscriptionTier) as any}
              sx={{ display: { xs: 'none', sm: 'inline-flex' } }}
            />
          )}
          
          <IconButton
            onClick={handleMenuOpen}
            sx={{ p: 0 }}
          >
            <Avatar sx={{ width: 32, height: 32, bgcolor: 'secondary.main' }}>
              {getAvatarContent()}
            </Avatar>
          </IconButton>
        </Box>

        {/* User Menu */}
        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={handleMenuClose}
          onClick={handleMenuClose}
          PaperProps={{
            elevation: 0,
            sx: {
              overflow: 'visible',
              filter: 'drop-shadow(0px 2px 8px rgba(0,0,0,0.32))',
              mt: 1.5,
              '& .MuiAvatar-root': {
                width: 32,
                height: 32,
                ml: -0.5,
                mr: 1,
              },
              '&:before': {
                content: '""',
                display: 'block',
                position: 'absolute',
                top: 0,
                right: 14,
                width: 10,
                height: 10,
                bgcolor: 'background.paper',
                transform: 'translateY(-50%) rotate(45deg)',
                zIndex: 0,
              },
            },
          }}
          transformOrigin={{ horizontal: 'right', vertical: 'top' }}
          anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
        >
          <MenuItem onClick={() => navigate('/profile')}>
            <Avatar sx={{ mr: 1 }}>
              {getAvatarContent()}
            </Avatar>
            <Box>
              <Typography variant="body1">{user?.name}</Typography>
              <Typography variant="body2" color="text.secondary">
                {user?.email}
              </Typography>
            </Box>
          </MenuItem>
          
          <Divider />
          
          <MenuItem onClick={() => navigate('/settings')}>
            <ListItemIcon>
              <SettingsIcon fontSize="small" />
            </ListItemIcon>
            Settings
          </MenuItem>
          
          <MenuItem onClick={() => navigate('/subscription')}>
            <ListItemIcon>
              <Star fontSize="small" />
            </ListItemIcon>
            Subscription
          </MenuItem>
          
          <Divider />
          
          <MenuItem onClick={handleLogout}>
            <ListItemIcon>
              <Logout fontSize="small" />
            </ListItemIcon>
            Logout
          </MenuItem>
        </Menu>
      </Toolbar>
    </AppBar>
  );
}