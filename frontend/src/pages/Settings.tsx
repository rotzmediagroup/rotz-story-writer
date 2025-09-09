import React, { useState, useEffect } from 'react';
import {
  Typography,
  Box,
  Card,
  CardContent,
  CardHeader,
  Button,
  IconButton,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  CircularProgress,
  Grid,
  Tabs,
  Tab,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Switch,
  FormControlLabel,
  InputAdornment,
  Paper,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Tooltip
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  Star as StarIcon,
  StarBorder as StarBorderIcon,
  Test as TestIcon,
  Save as SaveIcon,
  ExpandMore as ExpandMoreIcon,
  Key as KeyIcon,
  SmartToy as SmartToyIcon,
  Person as PersonIcon,
  Notifications as NotificationsIcon
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { apiClient } from '../lib/api';

interface AiConfig {
  id: string;
  name: string;
  provider: 'openai' | 'anthropic' | 'google';
  model: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

interface UserPreferences {
  emailNotifications: boolean;
  autoSave: boolean;
  defaultExportFormat: string;
  theme: 'light' | 'dark' | 'system';
  language: string;
}

const AI_PROVIDERS = [
  {
    value: 'openai',
    label: 'OpenAI',
    models: ['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo']
  },
  {
    value: 'anthropic',
    label: 'Anthropic',
    models: ['claude-3-opus-20240229', 'claude-3-sonnet-20240229', 'claude-3-haiku-20240307']
  },
  {
    value: 'google',
    label: 'Google AI',
    models: ['gemini-pro', 'gemini-pro-vision']
  }
];

export function Settings() {
  const { user } = useAuth();
  
  // State management
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // AI Configuration state
  const [aiConfigs, setAiConfigs] = useState<AiConfig[]>([]);
  const [configDialog, setConfigDialog] = useState(false);
  const [editingConfig, setEditingConfig] = useState<AiConfig | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<AiConfig | null>(null);
  const [testDialog, setTestDialog] = useState<AiConfig | null>(null);
  const [testResult, setTestResult] = useState<string | null>(null);

  // Form state for AI config
  const [configForm, setConfigForm] = useState({
    name: '',
    provider: 'openai' as const,
    model: '',
    apiKey: ''
  });
  const [showApiKey, setShowApiKey] = useState(false);

  // User preferences state
  const [preferences, setPreferences] = useState<UserPreferences>({
    emailNotifications: true,
    autoSave: true,
    defaultExportFormat: 'PDF',
    theme: 'light',
    language: 'en'
  });

  // Profile state
  const [profileForm, setProfileForm] = useState({
    name: user?.name || '',
    email: user?.email || '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [showPasswords, setShowPasswords] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const [configsResponse, preferencesResponse] = await Promise.all([
        apiClient.getAiConfigurations(),
        apiClient.getUserPreferences()
      ]);
      
      setAiConfigs(configsResponse.data || []);
      if (preferencesResponse.data) {
        setPreferences(preferencesResponse.data);
      }
    } catch (error: any) {
      console.error('Failed to fetch settings:', error);
      setError('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleConfigSubmit = async () => {
    try {
      setSaving(true);
      setError(null);

      const configData = {
        name: configForm.name,
        provider: configForm.provider,
        model: configForm.model,
        apiKey: configForm.apiKey
      };

      if (editingConfig) {
        await apiClient.updateAiConfiguration(editingConfig.id, configData);
        setAiConfigs(prev => prev.map(config => 
          config.id === editingConfig.id 
            ? { ...config, ...configData, updatedAt: new Date().toISOString() }
            : config
        ));
        setSuccess('AI configuration updated successfully');
      } else {
        const response = await apiClient.createAiConfiguration(configData);
        setAiConfigs(prev => [...prev, response.data]);
        setSuccess('AI configuration created successfully');
      }

      setConfigDialog(false);
      resetConfigForm();
    } catch (error: any) {
      console.error('Failed to save AI configuration:', error);
      setError(error.response?.data?.message || 'Failed to save AI configuration');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteConfig = async (config: AiConfig) => {
    try {
      setSaving(true);
      await apiClient.deleteAiConfiguration(config.id);
      setAiConfigs(prev => prev.filter(c => c.id !== config.id));
      setDeleteDialog(null);
      setSuccess('AI configuration deleted successfully');
    } catch (error: any) {
      console.error('Failed to delete AI configuration:', error);
      setError('Failed to delete AI configuration');
    } finally {
      setSaving(false);
    }
  };

  const handleSetDefaultConfig = async (configId: string) => {
    try {
      setSaving(true);
      await apiClient.setDefaultAiConfiguration(configId);
      setAiConfigs(prev => prev.map(config => ({
        ...config,
        isDefault: config.id === configId
      })));
      setSuccess('Default AI configuration updated');
    } catch (error: any) {
      console.error('Failed to set default configuration:', error);
      setError('Failed to set default configuration');
    } finally {
      setSaving(false);
    }
  };

  const handleTestConfig = async (config: AiConfig) => {
    try {
      setSaving(true);
      setTestResult(null);
      const response = await apiClient.testAiConfiguration(config.id);
      setTestResult(response.data.message || 'Configuration test successful!');
    } catch (error: any) {
      console.error('Failed to test configuration:', error);
      setTestResult('Test failed: ' + (error.response?.data?.message || 'Connection error'));
    } finally {
      setSaving(false);
    }
  };

  const handlePreferencesSubmit = async () => {
    try {
      setSaving(true);
      await apiClient.updateUserPreferences(preferences);
      setSuccess('Preferences updated successfully');
    } catch (error: any) {
      console.error('Failed to update preferences:', error);
      setError('Failed to update preferences');
    } finally {
      setSaving(false);
    }
  };

  const handleProfileSubmit = async () => {
    try {
      setSaving(true);
      setError(null);

      if (profileForm.newPassword && profileForm.newPassword !== profileForm.confirmPassword) {
        setError('New passwords do not match');
        return;
      }

      const updates: any = {
        name: profileForm.name,
        email: profileForm.email
      };

      if (profileForm.newPassword) {
        updates.currentPassword = profileForm.currentPassword;
        updates.newPassword = profileForm.newPassword;
      }

      await apiClient.updateProfile(updates);
      setSuccess('Profile updated successfully');
      
      // Clear password fields
      setProfileForm(prev => ({
        ...prev,
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      }));
    } catch (error: any) {
      console.error('Failed to update profile:', error);
      setError('Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const resetConfigForm = () => {
    setConfigForm({
      name: '',
      provider: 'openai',
      model: '',
      apiKey: ''
    });
    setEditingConfig(null);
  };

  const openEditDialog = (config?: AiConfig) => {
    if (config) {
      setConfigForm({
        name: config.name,
        provider: config.provider,
        model: config.model,
        apiKey: '' // Don't show existing API key for security
      });
      setEditingConfig(config);
    } else {
      resetConfigForm();
    }
    setConfigDialog(true);
  };

  if (!user) {
    return (
      <Alert severity="warning">
        Please log in to access settings.
      </Alert>
    );
  }

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 1000, mx: 'auto', p: 3 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Settings
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      <Card>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={activeTab} onChange={(e, newValue) => setActiveTab(newValue)}>
            <Tab icon={<SmartToyIcon />} label="AI Configuration" />
            <Tab icon={<PersonIcon />} label="Profile" />
            <Tab icon={<NotificationsIcon />} label="Preferences" />
          </Tabs>
        </Box>

        {/* AI Configuration Tab */}
        {activeTab === 0 && (
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'between', alignItems: 'center', mb: 3 }}>
              <Typography variant="h6">AI Provider Configurations</Typography>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => openEditDialog()}
              >
                Add Configuration
              </Button>
            </Box>

            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Configure your AI providers and API keys. These will be used to generate story content.
              API keys are encrypted and stored securely.
            </Typography>

            {aiConfigs.length === 0 ? (
              <Paper sx={{ p: 4, textAlign: 'center', bgcolor: 'background.default' }}>
                <SmartToyIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
                <Typography variant="h6" gutterBottom>
                  No AI Configurations
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  Add your first AI provider configuration to start generating stories.
                </Typography>
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={() => openEditDialog()}
                >
                  Add Configuration
                </Button>
              </Paper>
            ) : (
              <Grid container spacing={2}>
                {aiConfigs.map((config) => (
                  <Grid item xs={12} md={6} key={config.id}>
                    <Card variant="outlined">
                      <CardContent>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                          <Box>
                            <Typography variant="h6" component="div">
                              {config.name}
                              {config.isDefault && (
                                <Chip
                                  icon={<StarIcon />}
                                  label="Default"
                                  size="small"
                                  color="primary"
                                  sx={{ ml: 1 }}
                                />
                              )}
                            </Typography>
                            <Typography color="text.secondary" gutterBottom>
                              {config.provider.toUpperCase()} - {config.model}
                            </Typography>
                          </Box>
                          
                          <Box>
                            <Tooltip title="Set as Default">
                              <IconButton
                                onClick={() => handleSetDefaultConfig(config.id)}
                                disabled={config.isDefault || saving}
                              >
                                {config.isDefault ? <StarIcon color="primary" /> : <StarBorderIcon />}
                              </IconButton>
                            </Tooltip>
                          </Box>
                        </Box>

                        <Box sx={{ display: 'flex', gap: 1 }}>
                          <Button
                            size="small"
                            startIcon={<TestIcon />}
                            onClick={() => {
                              setTestDialog(config);
                              handleTestConfig(config);
                            }}
                            disabled={saving}
                          >
                            Test
                          </Button>
                          <Button
                            size="small"
                            startIcon={<EditIcon />}
                            onClick={() => openEditDialog(config)}
                          >
                            Edit
                          </Button>
                          <Button
                            size="small"
                            color="error"
                            startIcon={<DeleteIcon />}
                            onClick={() => setDeleteDialog(config)}
                            disabled={config.isDefault}
                          >
                            Delete
                          </Button>
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            )}
          </CardContent>
        )}

        {/* Profile Tab */}
        {activeTab === 1 && (
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Profile Information
            </Typography>

            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Name"
                  value={profileForm.name}
                  onChange={(e) => setProfileForm(prev => ({ ...prev, name: e.target.value }))}
                  margin="normal"
                />
              </Grid>
              
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Email"
                  type="email"
                  value={profileForm.email}
                  onChange={(e) => setProfileForm(prev => ({ ...prev, email: e.target.value }))}
                  margin="normal"
                />
              </Grid>
            </Grid>

            <Divider sx={{ my: 3 }} />

            <Accordion>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="h6">Change Password</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Current Password"
                      type={showPasswords ? 'text' : 'password'}
                      value={profileForm.currentPassword}
                      onChange={(e) => setProfileForm(prev => ({ ...prev, currentPassword: e.target.value }))}
                      margin="normal"
                      InputProps={{
                        endAdornment: (
                          <InputAdornment position="end">
                            <IconButton onClick={() => setShowPasswords(!showPasswords)}>
                              {showPasswords ? <VisibilityOffIcon /> : <VisibilityIcon />}
                            </IconButton>
                          </InputAdornment>
                        )
                      }}
                    />
                  </Grid>
                  
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="New Password"
                      type={showPasswords ? 'text' : 'password'}
                      value={profileForm.newPassword}
                      onChange={(e) => setProfileForm(prev => ({ ...prev, newPassword: e.target.value }))}
                      margin="normal"
                    />
                  </Grid>
                  
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="Confirm New Password"
                      type={showPasswords ? 'text' : 'password'}
                      value={profileForm.confirmPassword}
                      onChange={(e) => setProfileForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                      margin="normal"
                    />
                  </Grid>
                </Grid>
              </AccordionDetails>
            </Accordion>

            <Box sx={{ mt: 3 }}>
              <Button
                variant="contained"
                startIcon={saving ? <CircularProgress size={16} /> : <SaveIcon />}
                onClick={handleProfileSubmit}
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Update Profile'}
              </Button>
            </Box>
          </CardContent>
        )}

        {/* Preferences Tab */}
        {activeTab === 2 && (
          <CardContent>
            <Typography variant="h6" gutterBottom>
              User Preferences
            </Typography>

            <List>
              <ListItem>
                <ListItemText
                  primary="Email Notifications"
                  secondary="Receive email notifications about story generation progress"
                />
                <ListItemSecondaryAction>
                  <Switch
                    checked={preferences.emailNotifications}
                    onChange={(e) => setPreferences(prev => ({ ...prev, emailNotifications: e.target.checked }))}
                  />
                </ListItemSecondaryAction>
              </ListItem>

              <ListItem>
                <ListItemText
                  primary="Auto-save"
                  secondary="Automatically save changes while editing"
                />
                <ListItemSecondaryAction>
                  <Switch
                    checked={preferences.autoSave}
                    onChange={(e) => setPreferences(prev => ({ ...prev, autoSave: e.target.checked }))}
                  />
                </ListItemSecondaryAction>
              </ListItem>
            </List>

            <Grid container spacing={3} sx={{ mt: 2 }}>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Default Export Format</InputLabel>
                  <Select
                    value={preferences.defaultExportFormat}
                    onChange={(e) => setPreferences(prev => ({ ...prev, defaultExportFormat: e.target.value }))}
                    label="Default Export Format"
                  >
                    <MenuItem value="PDF">PDF</MenuItem>
                    <MenuItem value="DOCX">Word Document</MenuItem>
                    <MenuItem value="EPUB">EPUB</MenuItem>
                    <MenuItem value="TXT">Plain Text</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Theme</InputLabel>
                  <Select
                    value={preferences.theme}
                    onChange={(e) => setPreferences(prev => ({ ...prev, theme: e.target.value as any }))}
                    label="Theme"
                  >
                    <MenuItem value="light">Light</MenuItem>
                    <MenuItem value="dark">Dark</MenuItem>
                    <MenuItem value="system">System</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </Grid>

            <Box sx={{ mt: 3 }}>
              <Button
                variant="contained"
                startIcon={saving ? <CircularProgress size={16} /> : <SaveIcon />}
                onClick={handlePreferencesSubmit}
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Save Preferences'}
              </Button>
            </Box>
          </CardContent>
        )}
      </Card>

      {/* AI Configuration Dialog */}
      <Dialog open={configDialog} onClose={() => setConfigDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingConfig ? 'Edit AI Configuration' : 'Add AI Configuration'}
        </DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Configuration Name"
            fullWidth
            variant="outlined"
            value={configForm.name}
            onChange={(e) => setConfigForm(prev => ({ ...prev, name: e.target.value }))}
            helperText="Give this configuration a descriptive name"
          />

          <FormControl fullWidth margin="normal">
            <InputLabel>AI Provider</InputLabel>
            <Select
              value={configForm.provider}
              onChange={(e) => {
                const provider = e.target.value as any;
                setConfigForm(prev => ({ 
                  ...prev, 
                  provider,
                  model: AI_PROVIDERS.find(p => p.value === provider)?.models[0] || ''
                }));
              }}
              label="AI Provider"
            >
              {AI_PROVIDERS.map((provider) => (
                <MenuItem key={provider.value} value={provider.value}>
                  {provider.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl fullWidth margin="normal">
            <InputLabel>Model</InputLabel>
            <Select
              value={configForm.model}
              onChange={(e) => setConfigForm(prev => ({ ...prev, model: e.target.value }))}
              label="Model"
            >
              {AI_PROVIDERS.find(p => p.value === configForm.provider)?.models.map((model) => (
                <MenuItem key={model} value={model}>
                  {model}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            margin="dense"
            label="API Key"
            fullWidth
            variant="outlined"
            type={showApiKey ? 'text' : 'password'}
            value={configForm.apiKey}
            onChange={(e) => setConfigForm(prev => ({ ...prev, apiKey: e.target.value }))}
            helperText={editingConfig ? "Leave empty to keep existing API key" : "Enter your API key for this provider"}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <KeyIcon />
                </InputAdornment>
              ),
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton onClick={() => setShowApiKey(!showApiKey)}>
                    {showApiKey ? <VisibilityOffIcon /> : <VisibilityIcon />}
                  </IconButton>
                </InputAdornment>
              )
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfigDialog(false)}>Cancel</Button>
          <Button
            onClick={handleConfigSubmit}
            variant="contained"
            disabled={saving || !configForm.name || !configForm.model}
            startIcon={saving ? <CircularProgress size={16} /> : null}
          >
            {saving ? 'Saving...' : (editingConfig ? 'Update' : 'Add')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteDialog} onClose={() => setDeleteDialog(null)}>
        <DialogTitle>Delete AI Configuration?</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete "{deleteDialog?.name}"? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialog(null)}>Cancel</Button>
          <Button
            onClick={() => deleteDialog && handleDeleteConfig(deleteDialog)}
            color="error"
            variant="contained"
            disabled={saving}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Test Configuration Dialog */}
      <Dialog open={!!testDialog} onClose={() => setTestDialog(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Test AI Configuration</DialogTitle>
        <DialogContent>
          <Typography gutterBottom>
            Testing connection to {testDialog?.name}...
          </Typography>
          
          {saving ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 2 }}>
              <CircularProgress size={20} />
              <Typography variant="body2">Testing connection...</Typography>
            </Box>
          ) : testResult && (
            <Alert severity={testResult.includes('failed') ? 'error' : 'success'} sx={{ mt: 2 }}>
              {testResult}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTestDialog(null)}>Close</Button>
          {testDialog && !saving && (
            <Button
              onClick={() => handleTestConfig(testDialog)}
              variant="contained"
              startIcon={<TestIcon />}
            >
              Test Again
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
}