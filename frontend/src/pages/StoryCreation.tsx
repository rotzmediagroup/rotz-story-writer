import React from 'react';
import { Typography, Box, Card, CardContent } from '@mui/material';

export function StoryCreation() {
  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        Create New Story
      </Typography>
      
      <Card>
        <CardContent>
          <Typography variant="body1" color="text.secondary">
            Story creation wizard will be implemented in upcoming tasks.
            This will include:
          </Typography>
          <Box component="ul" sx={{ mt: 2 }}>
            <li>Basic story information (title, premise, genre)</li>
            <li>Audience and content configuration</li>
            <li>Story structure and style settings</li>
            <li>Themes and advanced settings</li>
            <li>AI provider configuration</li>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}