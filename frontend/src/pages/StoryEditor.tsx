import React from 'react';
import { Typography, Box, Card, CardContent } from '@mui/material';
import { useParams } from 'react-router-dom';

export function StoryEditor() {
  const { storyId } = useParams<{ storyId: string }>();

  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        Story Editor
      </Typography>
      
      <Card>
        <CardContent>
          <Typography variant="body1" color="text.secondary" paragraph>
            Story editor for story ID: {storyId}
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Story editor interface will be implemented in upcoming tasks.
            This will include:
          </Typography>
          <Box component="ul" sx={{ mt: 2 }}>
            <li>Chapter management and navigation</li>
            <li>Rich text editor with formatting</li>
            <li>Real-time progress tracking</li>
            <li>AI-powered revision suggestions</li>
            <li>Export options panel</li>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}