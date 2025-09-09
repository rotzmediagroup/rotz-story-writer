import React from 'react';
import {
  Box,
  Typography,
  Button,
  Grid,
  Card,
  CardContent,
  CardActions,
  Chip,
} from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

export function Dashboard() {
  const navigate = useNavigate();

  // Placeholder data - will be replaced with actual data from API
  const stories = [
    {
      id: '1',
      title: 'The Lost Expedition',
      genre: 'Fantasy',
      status: 'draft',
      wordCount: 0,
      createdAt: '2025-01-09T12:00:00Z',
    },
    // More stories will come from API
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'default';
      case 'planning': return 'info';
      case 'generating': return 'warning';
      case 'complete': return 'success';
      case 'archived': return 'secondary';
      default: return 'default';
    }
  };

  return (
    <Box>
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        mb: 4 
      }}>
        <Typography variant="h4" component="h1">
          My Stories
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
        <Card sx={{ textAlign: 'center', py: 6 }}>
          <CardContent>
            <Typography variant="h6" color="text.secondary" gutterBottom>
              No stories yet
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              Get started by creating your first AI-generated story
            </Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => navigate('/create')}
            >
              Create Your First Story
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Grid container spacing={3}>
          {stories.map((story) => (
            <Grid item xs={12} sm={6} md={4} key={story.id}>
              <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <CardContent sx={{ flexGrow: 1 }}>
                  <Typography variant="h6" component="h2" gutterBottom>
                    {story.title}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                    <Chip 
                      label={story.genre} 
                      size="small" 
                      variant="outlined"
                    />
                    <Chip 
                      label={story.status} 
                      size="small" 
                      color={getStatusColor(story.status) as any}
                    />
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    {story.wordCount.toLocaleString()} words
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Created {new Date(story.createdAt).toLocaleDateString()}
                  </Typography>
                </CardContent>
                <CardActions>
                  <Button 
                    size="small"
                    onClick={() => navigate(`/stories/${story.id}/edit`)}
                  >
                    Edit
                  </Button>
                  <Button size="small" color="secondary">
                    Export
                  </Button>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  );
}