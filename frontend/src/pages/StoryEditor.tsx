import React, { useState, useEffect, useCallback } from 'react';
import {
  Typography,
  Box,
  Card,
  CardContent,
  Button,
  IconButton,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemButton,
  Drawer,
  AppBar,
  Toolbar,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  LinearProgress,
  Alert,
  Menu,
  MenuItem,
  CircularProgress,
  Grid,
  Paper,
  Tabs,
  Tab,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Fab,
  Tooltip,
  Badge
} from '@mui/material';
import {
  Menu as MenuIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  PlayArrow as PlayArrowIcon,
  Stop as StopIcon,
  Download as DownloadIcon,
  Refresh as RefreshIcon,
  Settings as SettingsIcon,
  AutoStories as AutoStoriesIcon,
  Psychology as PsychologyIcon,
  ExpandMore as ExpandMoreIcon,
  Save as SaveIcon,
  MoreVert as MoreVertIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon
} from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { apiClient } from '../lib/api';

interface Story {
  id: string;
  title: string;
  premise: string;
  genre: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  metadata: any;
  chapters?: Chapter[];
}

interface Chapter {
  id: string;
  storyId: string;
  chapterNumber: number;
  title: string;
  content: string;
  status: 'draft' | 'generating' | 'completed' | 'error';
  wordCount: number;
  createdAt: string;
  updatedAt: string;
}

interface GenerationProgress {
  storyId: string;
  status: 'idle' | 'planning' | 'generating' | 'completed' | 'error';
  progress: number;
  currentChapter?: number;
  totalChapters?: number;
  message?: string;
}

const DRAWER_WIDTH = 280;

export function StoryEditor() {
  const { storyId } = useParams<{ storyId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  // State management
  const [story, setStory] = useState<Story | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [selectedChapter, setSelectedChapter] = useState<Chapter | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Dialogs and menus
  const [newChapterDialog, setNewChapterDialog] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState<Chapter | null>(null);
  const [exportDialog, setExportDialog] = useState(false);
  const [chapterMenuAnchor, setChapterMenuAnchor] = useState<null | HTMLElement>(null);
  const [menuChapter, setMenuChapter] = useState<Chapter | null>(null);
  
  // Generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState<GenerationProgress | null>(null);
  
  // Form state
  const [newChapterTitle, setNewChapterTitle] = useState('');
  const [activeTab, setActiveTab] = useState(0);
  const [previewMode, setPreviewMode] = useState(false);

  useEffect(() => {
    if (storyId) {
      fetchStoryData();
    }
  }, [storyId]);

  const fetchStoryData = async () => {
    try {
      setLoading(true);
      const [storyResponse, chaptersResponse] = await Promise.all([
        apiClient.getStory(storyId!),
        apiClient.getChapters(storyId!)
      ]);
      
      setStory(storyResponse.data);
      setChapters(chaptersResponse.data || []);
      
      if (chaptersResponse.data && chaptersResponse.data.length > 0) {
        setSelectedChapter(chaptersResponse.data[0]);
      }
    } catch (error: any) {
      console.error('Failed to fetch story data:', error);
      setError(error.response?.data?.message || 'Failed to load story');
    } finally {
      setLoading(false);
    }
  };

  const handleChapterSelect = (chapter: Chapter) => {
    setSelectedChapter(chapter);
    setPreviewMode(false);
  };

  const handleContentChange = useCallback((event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (selectedChapter) {
      const updatedChapter = {
        ...selectedChapter,
        content: event.target.value,
        wordCount: event.target.value.split(/\s+/).filter(word => word.length > 0).length
      };
      setSelectedChapter(updatedChapter);
      
      // Update in chapters array
      setChapters(prev => prev.map(ch => 
        ch.id === updatedChapter.id ? updatedChapter : ch
      ));
    }
  }, [selectedChapter]);

  const handleSaveChapter = async () => {
    if (!selectedChapter) return;
    
    try {
      setSaving(true);
      await apiClient.updateChapter(selectedChapter.id, {
        title: selectedChapter.title,
        content: selectedChapter.content
      });
      
      // Update local state
      setChapters(prev => prev.map(ch => 
        ch.id === selectedChapter.id ? { ...selectedChapter, updatedAt: new Date().toISOString() } : ch
      ));
      
    } catch (error: any) {
      console.error('Failed to save chapter:', error);
      setError('Failed to save chapter');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateChapter = async () => {
    if (!storyId || !newChapterTitle.trim()) return;
    
    try {
      const newChapter = {
        title: newChapterTitle.trim(),
        chapterNumber: chapters.length + 1,
        content: '',
        status: 'draft' as const
      };
      
      const response = await apiClient.createChapter(storyId, newChapter);
      const createdChapter = response.data;
      
      setChapters(prev => [...prev, createdChapter]);
      setSelectedChapter(createdChapter);
      setNewChapterTitle('');
      setNewChapterDialog(false);
      
    } catch (error: any) {
      console.error('Failed to create chapter:', error);
      setError('Failed to create chapter');
    }
  };

  const handleDeleteChapter = async (chapter: Chapter) => {
    try {
      await apiClient.deleteChapter(chapter.id);
      
      setChapters(prev => prev.filter(ch => ch.id !== chapter.id));
      
      if (selectedChapter?.id === chapter.id) {
        const remainingChapters = chapters.filter(ch => ch.id !== chapter.id);
        setSelectedChapter(remainingChapters[0] || null);
      }
      
      setDeleteDialog(null);
    } catch (error: any) {
      console.error('Failed to delete chapter:', error);
      setError('Failed to delete chapter');
    }
  };

  const handleGenerateChapter = async (chapter: Chapter) => {
    try {
      setIsGenerating(true);
      await apiClient.generateChapter(chapter.id);
      
      // Update chapter status
      const updatedChapter = { ...chapter, status: 'generating' as const };
      setChapters(prev => prev.map(ch => 
        ch.id === chapter.id ? updatedChapter : ch
      ));
      
      if (selectedChapter?.id === chapter.id) {
        setSelectedChapter(updatedChapter);
      }
      
    } catch (error: any) {
      console.error('Failed to generate chapter:', error);
      setError('Failed to generate chapter');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleExportStory = async (format: string) => {
    try {
      const response = await apiClient.exportStory(storyId!, format);
      
      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${story?.title || 'story'}.${format.toLowerCase()}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      setExportDialog(false);
    } catch (error: any) {
      console.error('Failed to export story:', error);
      setError('Failed to export story');
    }
  };

  const handleChapterMenu = (event: React.MouseEvent<HTMLElement>, chapter: Chapter) => {
    setChapterMenuAnchor(event.currentTarget);
    setMenuChapter(chapter);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'success';
      case 'generating': return 'warning';
      case 'error': return 'error';
      default: return 'default';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'generating': return <CircularProgress size={16} />;
      case 'completed': return '✓';
      case 'error': return '⚠';
      default: return '○';
    }
  };

  if (!user) {
    return (
      <Alert severity="warning">
        Please log in to edit stories.
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

  if (!story) {
    return (
      <Alert severity="error">
        Story not found. <Button onClick={() => navigate('/dashboard')}>Return to Dashboard</Button>
      </Alert>
    );
  }

  return (
    <Box sx={{ display: 'flex', height: '100vh' }}>
      {/* Sidebar */}
      <Drawer
        variant="persistent"
        anchor="left"
        open={drawerOpen}
        sx={{
          width: DRAWER_WIDTH,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: DRAWER_WIDTH,
            boxSizing: 'border-box',
            position: 'relative',
            height: '100%'
          },
        }}
      >
        <Box sx={{ p: 2 }}>
          <Typography variant="h6" noWrap component="div" gutterBottom>
            {story.title}
          </Typography>
          
          <Chip 
            label={story.status} 
            color={getStatusColor(story.status) as any}
            size="small" 
            sx={{ mb: 2 }}
          />
          
          <Button
            variant="outlined"
            startIcon={<AddIcon />}
            onClick={() => setNewChapterDialog(true)}
            fullWidth
            sx={{ mb: 2 }}
          >
            New Chapter
          </Button>
        </Box>

        <Divider />

        <Box sx={{ flexGrow: 1, overflow: 'auto' }}>
          <List>
            {chapters.map((chapter) => (
              <ListItem key={chapter.id} disablePadding>
                <ListItemButton
                  selected={selectedChapter?.id === chapter.id}
                  onClick={() => handleChapterSelect(chapter)}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                    <Box sx={{ mr: 1 }}>
                      {getStatusIcon(chapter.status)}
                    </Box>
                    
                    <ListItemText
                      primary={
                        <Typography variant="body2" fontWeight={chapter.status === 'completed' ? 'bold' : 'normal'}>
                          Chapter {chapter.chapterNumber}
                        </Typography>
                      }
                      secondary={
                        <Box>
                          <Typography variant="caption" display="block">
                            {chapter.title || 'Untitled'}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {chapter.wordCount} words
                          </Typography>
                        </Box>
                      }
                    />
                    
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleChapterMenu(e, chapter);
                      }}
                    >
                      <MoreVertIcon fontSize="small" />
                    </IconButton>
                  </Box>
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        </Box>

        <Divider />
        
        <Box sx={{ p: 2 }}>
          <Button
            variant="contained"
            color="primary"
            startIcon={<PlayArrowIcon />}
            onClick={() => {/* TODO: Implement full story generation */}}
            fullWidth
            sx={{ mb: 1 }}
            disabled={isGenerating}
          >
            Generate Story
          </Button>
          
          <Button
            variant="outlined"
            startIcon={<DownloadIcon />}
            onClick={() => setExportDialog(true)}
            fullWidth
          >
            Export
          </Button>
        </Box>
      </Drawer>

      {/* Main Content */}
      <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Top Bar */}
        <AppBar position="static" color="transparent" elevation={1}>
          <Toolbar>
            <IconButton
              edge="start"
              color="inherit"
              onClick={() => setDrawerOpen(!drawerOpen)}
              sx={{ mr: 2 }}
            >
              <MenuIcon />
            </IconButton>
            
            <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
              {selectedChapter ? `Chapter ${selectedChapter.chapterNumber}: ${selectedChapter.title || 'Untitled'}` : 'Select a Chapter'}
            </Typography>

            {selectedChapter && (
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Tooltip title={previewMode ? "Edit Mode" : "Preview Mode"}>
                  <IconButton onClick={() => setPreviewMode(!previewMode)}>
                    {previewMode ? <EditIcon /> : <VisibilityIcon />}
                  </IconButton>
                </Tooltip>
                
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={saving ? <CircularProgress size={16} /> : <SaveIcon />}
                  onClick={handleSaveChapter}
                  disabled={saving}
                >
                  {saving ? 'Saving...' : 'Save'}
                </Button>
                
                <Button
                  variant="contained"
                  size="small"
                  startIcon={<PlayArrowIcon />}
                  onClick={() => handleGenerateChapter(selectedChapter)}
                  disabled={isGenerating || selectedChapter.status === 'generating'}
                >
                  {selectedChapter.status === 'generating' ? 'Generating...' : 'Generate'}
                </Button>
              </Box>
            )}
          </Toolbar>
        </AppBar>

        {/* Content Area */}
        <Box sx={{ flexGrow: 1, p: 3, overflow: 'auto' }}>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          {selectedChapter ? (
            <Card>
              <CardContent>
                <Box sx={{ mb: 2 }}>
                  <Tabs value={activeTab} onChange={(e, newValue) => setActiveTab(newValue)}>
                    <Tab label="Content" />
                    <Tab label="Chapter Info" />
                    <Tab label="AI Settings" />
                  </Tabs>
                </Box>

                {activeTab === 0 && (
                  <Box>
                    {previewMode ? (
                      <Paper sx={{ p: 3, minHeight: 400, whiteSpace: 'pre-wrap' }}>
                        <Typography variant="body1">
                          {selectedChapter.content || 'No content yet. Click "Generate" to create AI-generated content or switch to Edit Mode to write manually.'}
                        </Typography>
                      </Paper>
                    ) : (
                      <TextField
                        fullWidth
                        multiline
                        minRows={20}
                        maxRows={25}
                        value={selectedChapter.content}
                        onChange={handleContentChange}
                        placeholder="Start writing your chapter here, or click 'Generate' to create AI-generated content..."
                        variant="outlined"
                        sx={{
                          '& .MuiInputBase-root': {
                            fontFamily: 'Georgia, serif',
                            fontSize: '16px',
                            lineHeight: 1.6
                          }
                        }}
                      />
                    )}
                  </Box>
                )}

                {activeTab === 1 && (
                  <Box>
                    <Grid container spacing={2}>
                      <Grid item xs={12} md={6}>
                        <TextField
                          fullWidth
                          label="Chapter Title"
                          value={selectedChapter.title}
                          onChange={(e) => setSelectedChapter({
                            ...selectedChapter,
                            title: e.target.value
                          })}
                          margin="normal"
                        />
                      </Grid>
                      
                      <Grid item xs={12} md={6}>
                        <TextField
                          fullWidth
                          label="Chapter Number"
                          type="number"
                          value={selectedChapter.chapterNumber}
                          onChange={(e) => setSelectedChapter({
                            ...selectedChapter,
                            chapterNumber: parseInt(e.target.value) || 1
                          })}
                          margin="normal"
                        />
                      </Grid>

                      <Grid item xs={12} md={4}>
                        <Typography variant="body2" color="text.secondary">
                          Status: <Chip label={selectedChapter.status} size="small" color={getStatusColor(selectedChapter.status) as any} />
                        </Typography>
                      </Grid>
                      
                      <Grid item xs={12} md={4}>
                        <Typography variant="body2" color="text.secondary">
                          Word Count: {selectedChapter.wordCount}
                        </Typography>
                      </Grid>
                      
                      <Grid item xs={12} md={4}>
                        <Typography variant="body2" color="text.secondary">
                          Last Updated: {new Date(selectedChapter.updatedAt).toLocaleDateString()}
                        </Typography>
                      </Grid>
                    </Grid>
                  </Box>
                )}

                {activeTab === 2 && (
                  <Box>
                    <Accordion>
                      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                        <Typography variant="h6">Generation Settings</Typography>
                      </AccordionSummary>
                      <AccordionDetails>
                        <Typography variant="body2" color="text.secondary" gutterBottom>
                          Settings for AI-generated content will be available here.
                          This will include tone, style preferences, and chapter-specific instructions.
                        </Typography>
                      </AccordionDetails>
                    </Accordion>
                  </Box>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent sx={{ textAlign: 'center', py: 8 }}>
                <AutoStoriesIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                <Typography variant="h5" gutterBottom>
                  Select a Chapter
                </Typography>
                <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                  Choose a chapter from the sidebar to start editing, or create a new chapter to begin writing.
                </Typography>
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={() => setNewChapterDialog(true)}
                >
                  Create First Chapter
                </Button>
              </CardContent>
            </Card>
          )}
        </Box>
      </Box>

      {/* Floating Action Button */}
      {selectedChapter && (
        <Fab
          color="primary"
          sx={{ position: 'fixed', bottom: 16, right: 16 }}
          onClick={handleSaveChapter}
          disabled={saving}
        >
          {saving ? <CircularProgress size={24} /> : <SaveIcon />}
        </Fab>
      )}

      {/* New Chapter Dialog */}
      <Dialog open={newChapterDialog} onClose={() => setNewChapterDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create New Chapter</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Chapter Title"
            fullWidth
            variant="outlined"
            value={newChapterTitle}
            onChange={(e) => setNewChapterTitle(e.target.value)}
            helperText="Enter a title for the new chapter"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNewChapterDialog(false)}>Cancel</Button>
          <Button onClick={handleCreateChapter} variant="contained" disabled={!newChapterTitle.trim()}>
            Create Chapter
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteDialog} onClose={() => setDeleteDialog(null)}>
        <DialogTitle>Delete Chapter?</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete "{deleteDialog?.title || `Chapter ${deleteDialog?.chapterNumber}`}"? 
            This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialog(null)}>Cancel</Button>
          <Button onClick={() => deleteDialog && handleDeleteChapter(deleteDialog)} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Export Dialog */}
      <Dialog open={exportDialog} onClose={() => setExportDialog(false)}>
        <DialogTitle>Export Story</DialogTitle>
        <DialogContent>
          <Typography gutterBottom>
            Choose a format to export your story:
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: 2 }}>
            <Button variant="outlined" onClick={() => handleExportStory('PDF')}>
              Export as PDF
            </Button>
            <Button variant="outlined" onClick={() => handleExportStory('DOCX')}>
              Export as Word Document
            </Button>
            <Button variant="outlined" onClick={() => handleExportStory('EPUB')}>
              Export as EPUB
            </Button>
            <Button variant="outlined" onClick={() => handleExportStory('TXT')}>
              Export as Plain Text
            </Button>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setExportDialog(false)}>Cancel</Button>
        </DialogActions>
      </Dialog>

      {/* Chapter Context Menu */}
      <Menu
        anchorEl={chapterMenuAnchor}
        open={Boolean(chapterMenuAnchor)}
        onClose={() => setChapterMenuAnchor(null)}
      >
        <MenuItem onClick={() => {
          if (menuChapter) handleGenerateChapter(menuChapter);
          setChapterMenuAnchor(null);
        }}>
          <PlayArrowIcon sx={{ mr: 1 }} />
          Generate Content
        </MenuItem>
        <MenuItem onClick={() => {
          setChapterMenuAnchor(null);
          setDeleteDialog(menuChapter);
        }}>
          <DeleteIcon sx={{ mr: 1 }} />
          Delete Chapter
        </MenuItem>
      </Menu>
    </Box>
  );
}