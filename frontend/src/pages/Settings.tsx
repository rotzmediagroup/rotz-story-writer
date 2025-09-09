import React from 'react';
import { Typography, Box, Card, CardContent } from '@mui/material';

export function Settings() {
  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        Settings
      </Typography>
      
      <Card>
        <CardContent>
          <Typography variant="body1" color="text.secondary">
            Settings interface will be implemented in upcoming tasks.
            This will include:
          </Typography>
          <Box component="ul" sx={{ mt: 2 }}>
            <li>AI provider configuration</li>
            <li>API key management</li>
            <li>Prompt template customization</li>
            <li>User preferences</li>
            <li>Account management</li>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}