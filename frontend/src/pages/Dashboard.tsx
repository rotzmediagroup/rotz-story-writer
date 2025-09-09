import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Grid,
  Paper,
  Typography,
  Button,
  Card,
  CardContent,
  CardActions,
  Box,
  Chip,
  LinearProgress,
  CircularProgress,
  Alert,
  IconButton,
  Menu,
  MenuItem,
  Tooltip,
  Fab,
  Skeleton,
} from '@mui/material';
import {
  Add as AddIcon,
  BookOpen,
  TrendingUp,
  Assessment,
  Timeline,
  MoreVert as MoreVertIcon,
  Launch as LaunchIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  GetApp as GetAppIcon,
} from '@mui/icons-material';
import { apiClient, Story } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';

interface StoryStats {
  totalStories: number;
  totalWords: number;
  storiesThisMonth: number;
  averageCompletion: number;
}

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [stories, setStories] = useState<Story[]>([]);
  const [stats, setStats] = useState<StoryStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedStory, setSelectedStory] = useState<string | null>(null);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch stories and user stats
      const [storiesResponse, userInfo] = await Promise.all([
        apiClient.getStories({ limit: 10, sortBy: 'updatedAt', sortOrder: 'desc' }),
        apiClient.getMe()
      ]);

      setStories(storiesResponse.stories);
      setStats({
        totalStories: userInfo.stats.totalStories || 0,
        totalWords: storiesResponse.stories.reduce((total, story) => total + (story.targetWordCount || 0), 0),
        storiesThisMonth: userInfo.stats.storiesThisMonth || 0,
        averageCompletion: 2.3 // This would come from backend calculations
      });

    } catch (error: any) {
      console.error('Failed to fetch dashboard data:', error);
      setError(error.response?.data?.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, storyId: string) => {
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
    setSelectedStory(storyId);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedStory(null);
  };

  const handleEditStory = () => {
    if (selectedStory) {
      navigate(`/stories/${selectedStory}/edit`);
    }
    handleMenuClose();
  };

  const handleDeleteStory = async () => {
    if (!selectedStory) return;

    try {
      await apiClient.deleteStory(selectedStory);
      setStories(stories.filter(story => story.id !== selectedStory));
      handleMenuClose();
    } catch (error: any) {
      console.error('Failed to delete story:', error);
      // Could show a toast notification here
    }
  };

  const getStatusColor = (status: string): 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning' => {
    switch (status) {
      case 'planning': return 'info';
      case 'planned': return 'primary';
      case 'generating': return 'warning';
      case 'generated': return 'success';
      case 'published': return 'success';
      case 'archived': return 'default';
      case 'cancelled': return 'error';
      default: return 'default';
    }
  };

  const getProgressPercentage = (story: Story): number => {
    switch (story.status) {
      case 'planning': return 10;
      case 'planned': return 25;
      case 'generating': return 60;
      case 'generated': return 90;
      case 'published': return 100;
      case 'archived': return 100;
      default: return 0;
    }
  };

  if (loading) {
    return (
      <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
        <Grid container spacing={3}>
          {/* Header Skeleton */}
          <Grid item xs={12}>
            <Skeleton variant="text" width={300} height={48} />
            <Skeleton variant="text" width={500} height={24} />
          </Grid>
          
          {/* Stats Cards Skeleton */}
          {[1, 2, 3, 4].map(i => (
            <Grid item xs={12} sm={6} md={3} key={i}>
              <Skeleton variant="rectangular" height={120} />
            </Grid>
          ))}
          
          {/* Stories Skeleton */}
          {[1, 2, 3].map(i => (
            <Grid item xs={12} md={4} key={i}>
              <Skeleton variant="rectangular" height={200} />
            </Grid>
          ))}
        </Grid>
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth="xl" sx={{ mt: 4 }}>
        <Alert severity="error" action={
          <Button color="inherit" size="small" onClick={fetchDashboardData}>
            Retry
          </Button>
        }>
          {error}
        </Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h3" component="h1" gutterBottom color="primary">
          Welcome back, {user?.name}!
        </Typography>
        <Typography variant="h6" color="text.secondary" gutterBottom>
          Continue your storytelling journey with AI-powered creativity
        </Typography>
        
        {user?.subscriptionTier && (
          <Chip 
            label={`${user.subscriptionTier.toUpperCase()} Plan`} 
            color={user.subscriptionTier === 'free' ? 'default' : 'primary'}
            sx={{ mt: 1 }}
          />
        )}
      </Box>

      {/* Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography color="text.secondary" gutterBottom variant="body2">
                    Total Stories
                  </Typography>
                  <Typography variant="h4">
                    {stats?.totalStories || 0}
                  </Typography>
                </Box>
                <BookOpen color="primary" />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography color="text.secondary" gutterBottom variant="body2">
                    Total Words
                  </Typography>
                  <Typography variant="h4">
                    {stats?.totalWords.toLocaleString() || 0}
                  </Typography>
                </Box>
                <Assessment color="primary" />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography color="text.secondary" gutterBottom variant="body2">
                    This Month
                  </Typography>
                  <Typography variant="h4">
                    {stats?.storiesThisMonth || 0}
                  </Typography>
                </Box>
                <Timeline color="primary" />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography color="text.secondary" gutterBottom variant="body2">
                    Avg. Completion
                  </Typography>
                  <Typography variant="h4">
                    {stats?.averageCompletion}d
                  </Typography>
                </Box>
                <TrendingUp color="primary" />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Stories Section */}
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
          <Typography variant="h4" component="h2">
            Your Stories
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => navigate('/create')}
            size="large"
          >
            Create New Story
          </Button>
        </Box>

        {stories.length === 0 ? (
          <Paper sx={{ p: 6, textAlign: 'center' }}>
            <BookOpen sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h5" gutterBottom>
              No stories yet
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
              Get started by creating your first AI-generated story
            </Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => navigate('/create')}
              size="large"
            >
              Create Your First Story
            </Button>
          </Paper>
        ) : (
          <Grid container spacing={3}>
            {stories.map((story) => (
              <Grid item xs={12} md={6} lg={4} key={story.id}>
                <Card 
                  sx={{ 
                    height: '100%', 
                    display: 'flex', 
                    flexDirection: 'column',
                    cursor: 'pointer',
                    '&:hover': {
                      elevation: 4,
                      transform: 'translateY(-2px)',
                      transition: 'all 0.2s ease-in-out'
                    }
                  }}
                  onClick={() => navigate(`/stories/${story.id}/edit`)}
                >
                  <CardContent sx={{ flexGrow: 1 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                      <Typography variant="h6" component="h3" noWrap sx={{ flexGrow: 1, mr: 1 }}>
                        {story.title}
                      </Typography>
                      <IconButton
                        size="small"
                        onClick={(e) => handleMenuOpen(e, story.id)}
                      >
                        <MoreVertIcon />
                      </IconButton>
                    </Box>

                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      {story.description}
                    </Typography>

                    <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                      <Chip label={story.genre} size="small" />
                      <Chip 
                        label={story.status}
                        size="small"
                        color={getStatusColor(story.status)}
                      />
                    </Box>

                    <Box sx={{ mb: 2 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                        <Typography variant="body2" color="text.secondary">
                          Progress
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {getProgressPercentage(story)}%
                        </Typography>
                      </Box>
                      <LinearProgress 
                        variant="determinate" 
                        value={getProgressPercentage(story)} 
                        sx={{ height: 6, borderRadius: 3 }}
                      />
                    </Box>

                    <Typography variant="body2" color="text.secondary">
                      Target: {story.targetWordCount.toLocaleString()} words
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Created: {new Date(story.createdAt).toLocaleDateString()}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}
      </Grid>

      {/* Menu for story actions */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={handleEditStory}>
          <EditIcon sx={{ mr: 1 }} />
          Edit
        </MenuItem>
        <MenuItem onClick={handleMenuClose}>
          <LaunchIcon sx={{ mr: 1 }} />
          View Details
        </MenuItem>
        <MenuItem onClick={handleMenuClose}>
          <GetAppIcon sx={{ mr: 1 }} />
          Export
        </MenuItem>
        <MenuItem onClick={handleDeleteStory} sx={{ color: 'error.main' }}>
          <DeleteIcon sx={{ mr: 1 }} />
          Delete
        </MenuItem>
      </Menu>

      {/* Floating Action Button */}
      <Fab
        color="primary"
        aria-label="create story"
        sx={{ position: 'fixed', bottom: 16, right: 16 }}
        onClick={() => navigate('/create')}
      >
        <AddIcon />
      </Fab>
    </Container>
  );
};