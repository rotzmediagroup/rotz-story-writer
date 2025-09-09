import React, { useState, useEffect } from 'react';
import {
  Typography,
  Box,
  Card,
  CardContent,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Button,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Grid,
  Slider,
  FormControlLabel,
  Switch,
  Alert,
  CircularProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Divider,
  ListItemText,
  OutlinedInput,
  SelectChangeEvent
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  AutoStories as AutoStoriesIcon,
  Psychology as PsychologyIcon,
  Settings as SettingsIcon,
  Palette as PaletteIcon,
  SmartToy as SmartToyIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { apiClient } from '../lib/api';

interface StoryFormData {
  title: string;
  premise: string;
  genre: string;
  subgenres: string[];
  targetAudience: string;
  contentRating: string;
  storyLength: number;
  chapterCount: number;
  writingStyle: string;
  pointOfView: string;
  tense: string;
  themes: string[];
  customThemes: string;
  characterDevelopment: boolean;
  plotComplexity: number;
  dialogueAmount: number;
  descriptiveDetail: number;
  pacing: string;
  aiProvider: string;
}

const steps = [
  {
    label: 'Basic Information',
    description: 'Title, premise, and genre',
    icon: <AutoStoriesIcon />
  },
  {
    label: 'Story Structure',
    description: 'Length, chapters, and format',
    icon: <SettingsIcon />
  },
  {
    label: 'Writing Style',
    description: 'Voice, perspective, and tone',
    icon: <PaletteIcon />
  },
  {
    label: 'Themes & Content',
    description: 'Themes and content preferences',
    icon: <PsychologyIcon />
  },
  {
    label: 'AI Configuration',
    description: 'Choose your AI writing assistant',
    icon: <SmartToyIcon />
  }
];

const genres = [
  'Fantasy', 'Science Fiction', 'Mystery', 'Thriller', 'Romance', 'Horror',
  'Adventure', 'Historical Fiction', 'Contemporary Fiction', 'Young Adult',
  'Literary Fiction', 'Crime', 'Western', 'Dystopian', 'Comedy', 'Drama'
];

const subgenres = [
  'Urban Fantasy', 'Epic Fantasy', 'Space Opera', 'Cyberpunk', 'Steampunk',
  'Police Procedural', 'Cozy Mystery', 'Psychological Thriller', 'Paranormal Romance',
  'Gothic Horror', 'Coming of Age', 'Alternate History', 'Post-Apocalyptic'
];

const themes = [
  'Love and Relationships', 'Good vs Evil', 'Coming of Age', 'Power and Corruption',
  'Identity and Self-Discovery', 'Family', 'Friendship', 'Betrayal', 'Redemption',
  'Sacrifice', 'Survival', 'Freedom vs Security', 'Technology and Humanity',
  'Social Justice', 'Environmental Issues', 'War and Peace', 'Time and Memory'
];

const contentRatings = [
  { value: 'G', label: 'G - General Audiences' },
  { value: 'PG', label: 'PG - Some material may not be suitable for children' },
  { value: 'PG-13', label: 'PG-13 - Some material may be inappropriate for children under 13' },
  { value: 'R', label: 'R - Adult themes, language, and content' },
  { value: 'NC-17', label: 'NC-17 - Adult content not suitable for minors' }
];

const writingStyles = [
  'Literary', 'Commercial', 'Minimalist', 'Descriptive', 'Humorous', 'Dark',
  'Lyrical', 'Conversational', 'Formal', 'Stream of Consciousness'
];

const pacingOptions = ['Slow and contemplative', 'Steady and balanced', 'Fast-paced and action-packed'];

export function StoryCreation() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiProviders, setAiProviders] = useState<any[]>([]);

  const [formData, setFormData] = useState<StoryFormData>({
    title: '',
    premise: '',
    genre: '',
    subgenres: [],
    targetAudience: 'Adult',
    contentRating: 'PG-13',
    storyLength: 50000,
    chapterCount: 15,
    writingStyle: 'Commercial',
    pointOfView: 'Third Person Limited',
    tense: 'Past Tense',
    themes: [],
    customThemes: '',
    characterDevelopment: true,
    plotComplexity: 7,
    dialogueAmount: 5,
    descriptiveDetail: 5,
    pacing: 'Steady and balanced',
    aiProvider: ''
  });

  useEffect(() => {
    fetchAiProviders();
  }, []);

  const fetchAiProviders = async () => {
    try {
      const response = await apiClient.getAiConfigurations();
      setAiProviders(response.data || []);
      if (response.data && response.data.length > 0) {
        const defaultProvider = response.data.find((p: any) => p.isDefault) || response.data[0];
        setFormData(prev => ({ ...prev, aiProvider: defaultProvider.id }));
      }
    } catch (error) {
      console.error('Failed to fetch AI providers:', error);
    }
  };

  const handleInputChange = (field: keyof StoryFormData) => (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement> | SelectChangeEvent<any>
  ) => {
    const value = event.target.value;
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleMultiSelectChange = (field: keyof StoryFormData) => (event: SelectChangeEvent<string[]>) => {
    const value = event.target.value;
    setFormData(prev => ({ 
      ...prev, 
      [field]: typeof value === 'string' ? value.split(',') : value 
    }));
  };

  const handleSliderChange = (field: keyof StoryFormData) => (event: Event, newValue: number | number[]) => {
    setFormData(prev => ({ ...prev, [field]: newValue as number }));
  };

  const handleSwitchChange = (field: keyof StoryFormData) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, [field]: event.target.checked }));
  };

  const handleNext = () => {
    setActiveStep((prevActiveStep) => prevActiveStep + 1);
  };

  const handleBack = () => {
    setActiveStep((prevActiveStep) => prevActiveStep - 1);
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);

    try {
      const storyData = {
        title: formData.title,
        premise: formData.premise,
        genre: formData.genre,
        subgenres: formData.subgenres,
        metadata: {
          targetAudience: formData.targetAudience,
          contentRating: formData.contentRating,
          storyLength: formData.storyLength,
          chapterCount: formData.chapterCount,
          writingStyle: formData.writingStyle,
          pointOfView: formData.pointOfView,
          tense: formData.tense,
          themes: [...formData.themes, ...formData.customThemes.split(',').filter(t => t.trim())],
          characterDevelopment: formData.characterDevelopment,
          plotComplexity: formData.plotComplexity,
          dialogueAmount: formData.dialogueAmount,
          descriptiveDetail: formData.descriptiveDetail,
          pacing: formData.pacing
        },
        aiConfigId: formData.aiProvider,
        status: 'planning'
      };

      const response = await apiClient.createStory(storyData);
      
      // Navigate to the story editor
      navigate(`/stories/${response.data.id}`);
      
    } catch (error: any) {
      console.error('Failed to create story:', error);
      setError(error.response?.data?.message || 'Failed to create story');
    } finally {
      setLoading(false);
    }
  };

  const isStepValid = (step: number): boolean => {
    switch (step) {
      case 0:
        return formData.title.trim() !== '' && formData.premise.trim() !== '' && formData.genre !== '';
      case 1:
        return formData.storyLength > 0 && formData.chapterCount > 0;
      case 2:
        return formData.writingStyle !== '' && formData.pointOfView !== '' && formData.tense !== '';
      case 3:
        return true; // Themes are optional
      case 4:
        return formData.aiProvider !== '';
      default:
        return false;
    }
  };

  const renderStepContent = (step: number) => {
    switch (step) {
      case 0:
        return (
          <Box>
            <TextField
              fullWidth
              label="Story Title"
              value={formData.title}
              onChange={handleInputChange('title')}
              margin="normal"
              required
              helperText="Give your story a compelling title"
            />
            
            <TextField
              fullWidth
              label="Story Premise"
              value={formData.premise}
              onChange={handleInputChange('premise')}
              margin="normal"
              required
              multiline
              rows={4}
              helperText="Describe the main plot, conflict, or central idea of your story"
            />

            <FormControl fullWidth margin="normal" required>
              <InputLabel>Primary Genre</InputLabel>
              <Select
                value={formData.genre}
                onChange={handleInputChange('genre')}
                label="Primary Genre"
              >
                {genres.map((genre) => (
                  <MenuItem key={genre} value={genre}>
                    {genre}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth margin="normal">
              <InputLabel>Subgenres (Optional)</InputLabel>
              <Select
                multiple
                value={formData.subgenres}
                onChange={handleMultiSelectChange('subgenres')}
                input={<OutlinedInput label="Subgenres (Optional)" />}
                renderValue={(selected) => (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {(selected as string[]).map((value) => (
                      <Chip key={value} label={value} size="small" />
                    ))}
                  </Box>
                )}
              >
                {subgenres.map((subgenre) => (
                  <MenuItem key={subgenre} value={subgenre}>
                    <ListItemText primary={subgenre} />
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        );

      case 1:
        return (
          <Box>
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth margin="normal">
                  <InputLabel>Target Audience</InputLabel>
                  <Select
                    value={formData.targetAudience}
                    onChange={handleInputChange('targetAudience')}
                    label="Target Audience"
                  >
                    <MenuItem value="Children">Children (8-12)</MenuItem>
                    <MenuItem value="Young Adult">Young Adult (13-17)</MenuItem>
                    <MenuItem value="Adult">Adult (18+)</MenuItem>
                    <MenuItem value="All Ages">All Ages</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} md={6}>
                <FormControl fullWidth margin="normal">
                  <InputLabel>Content Rating</InputLabel>
                  <Select
                    value={formData.contentRating}
                    onChange={handleInputChange('contentRating')}
                    label="Content Rating"
                  >
                    {contentRatings.map((rating) => (
                      <MenuItem key={rating.value} value={rating.value}>
                        {rating.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} md={6}>
                <Typography gutterBottom>
                  Target Word Count: {formData.storyLength.toLocaleString()} words
                </Typography>
                <Slider
                  value={formData.storyLength}
                  onChange={handleSliderChange('storyLength')}
                  min={10000}
                  max={200000}
                  step={5000}
                  marks={[
                    { value: 10000, label: '10K' },
                    { value: 50000, label: '50K' },
                    { value: 100000, label: '100K' },
                    { value: 200000, label: '200K' }
                  ]}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <Typography gutterBottom>
                  Number of Chapters: {formData.chapterCount}
                </Typography>
                <Slider
                  value={formData.chapterCount}
                  onChange={handleSliderChange('chapterCount')}
                  min={1}
                  max={50}
                  step={1}
                  marks={[
                    { value: 1, label: '1' },
                    { value: 10, label: '10' },
                    { value: 25, label: '25' },
                    { value: 50, label: '50' }
                  ]}
                />
              </Grid>
            </Grid>
          </Box>
        );

      case 2:
        return (
          <Box>
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth margin="normal">
                  <InputLabel>Writing Style</InputLabel>
                  <Select
                    value={formData.writingStyle}
                    onChange={handleInputChange('writingStyle')}
                    label="Writing Style"
                  >
                    {writingStyles.map((style) => (
                      <MenuItem key={style} value={style}>
                        {style}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} md={6}>
                <FormControl fullWidth margin="normal">
                  <InputLabel>Point of View</InputLabel>
                  <Select
                    value={formData.pointOfView}
                    onChange={handleInputChange('pointOfView')}
                    label="Point of View"
                  >
                    <MenuItem value="First Person">First Person (I, me)</MenuItem>
                    <MenuItem value="Second Person">Second Person (You)</MenuItem>
                    <MenuItem value="Third Person Limited">Third Person Limited</MenuItem>
                    <MenuItem value="Third Person Omniscient">Third Person Omniscient</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} md={6}>
                <FormControl fullWidth margin="normal">
                  <InputLabel>Narrative Tense</InputLabel>
                  <Select
                    value={formData.tense}
                    onChange={handleInputChange('tense')}
                    label="Narrative Tense"
                  >
                    <MenuItem value="Past Tense">Past Tense</MenuItem>
                    <MenuItem value="Present Tense">Present Tense</MenuItem>
                    <MenuItem value="Future Tense">Future Tense</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} md={6}>
                <FormControl fullWidth margin="normal">
                  <InputLabel>Pacing</InputLabel>
                  <Select
                    value={formData.pacing}
                    onChange={handleInputChange('pacing')}
                    label="Pacing"
                  >
                    {pacingOptions.map((pace) => (
                      <MenuItem key={pace} value={pace}>
                        {pace}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            </Grid>

            <Divider sx={{ my: 3 }} />

            <Typography variant="h6" gutterBottom>
              Writing Preferences
            </Typography>

            <Grid container spacing={3}>
              <Grid item xs={12} md={4}>
                <Typography gutterBottom>
                  Plot Complexity: {formData.plotComplexity}/10
                </Typography>
                <Slider
                  value={formData.plotComplexity}
                  onChange={handleSliderChange('plotComplexity')}
                  min={1}
                  max={10}
                  step={1}
                  marks
                />
                <Typography variant="caption" color="text.secondary">
                  1 = Simple, linear plot | 10 = Complex, multi-layered
                </Typography>
              </Grid>

              <Grid item xs={12} md={4}>
                <Typography gutterBottom>
                  Dialogue Amount: {formData.dialogueAmount}/10
                </Typography>
                <Slider
                  value={formData.dialogueAmount}
                  onChange={handleSliderChange('dialogueAmount')}
                  min={1}
                  max={10}
                  step={1}
                  marks
                />
                <Typography variant="caption" color="text.secondary">
                  1 = Minimal dialogue | 10 = Dialogue-heavy
                </Typography>
              </Grid>

              <Grid item xs={12} md={4}>
                <Typography gutterBottom>
                  Descriptive Detail: {formData.descriptiveDetail}/10
                </Typography>
                <Slider
                  value={formData.descriptiveDetail}
                  onChange={handleSliderChange('descriptiveDetail')}
                  min={1}
                  max={10}
                  step={1}
                  marks
                />
                <Typography variant="caption" color="text.secondary">
                  1 = Minimal description | 10 = Highly descriptive
                </Typography>
              </Grid>
            </Grid>
          </Box>
        );

      case 3:
        return (
          <Box>
            <FormControl fullWidth margin="normal">
              <InputLabel>Themes</InputLabel>
              <Select
                multiple
                value={formData.themes}
                onChange={handleMultiSelectChange('themes')}
                input={<OutlinedInput label="Themes" />}
                renderValue={(selected) => (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {(selected as string[]).map((value) => (
                      <Chip key={value} label={value} size="small" />
                    ))}
                  </Box>
                )}
              >
                {themes.map((theme) => (
                  <MenuItem key={theme} value={theme}>
                    <ListItemText primary={theme} />
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              fullWidth
              label="Custom Themes"
              value={formData.customThemes}
              onChange={handleInputChange('customThemes')}
              margin="normal"
              helperText="Add custom themes separated by commas"
            />

            <FormControlLabel
              control={
                <Switch
                  checked={formData.characterDevelopment}
                  onChange={handleSwitchChange('characterDevelopment')}
                />
              }
              label="Focus on Character Development"
            />

            <Accordion sx={{ mt: 2 }}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography>Advanced Content Settings</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  These settings help fine-tune the content and style of your story.
                  The AI will use these preferences to guide the writing process.
                </Typography>
                
                <Box sx={{ mt: 2 }}>
                  <Typography variant="body2" gutterBottom>
                    <strong>Plot Complexity:</strong> Determines how intricate the storyline will be, 
                    including subplots, twists, and interconnected elements.
                  </Typography>
                  
                  <Typography variant="body2" gutterBottom>
                    <strong>Dialogue Amount:</strong> Controls the balance between dialogue and narrative. 
                    Higher values result in more character conversations.
                  </Typography>
                  
                  <Typography variant="body2">
                    <strong>Descriptive Detail:</strong> Influences how much sensory detail and 
                    environmental description appears in the story.
                  </Typography>
                </Box>
              </AccordionDetails>
            </Accordion>
          </Box>
        );

      case 4:
        return (
          <Box>
            <Typography variant="h6" gutterBottom>
              Choose AI Writing Assistant
            </Typography>
            
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Select the AI configuration to use for generating your story. 
              You can manage your AI configurations in the Settings page.
            </Typography>

            <FormControl fullWidth margin="normal" required>
              <InputLabel>AI Provider</InputLabel>
              <Select
                value={formData.aiProvider}
                onChange={handleInputChange('aiProvider')}
                label="AI Provider"
              >
                {aiProviders.map((provider) => (
                  <MenuItem key={provider.id} value={provider.id}>
                    <Box>
                      <Typography variant="body1">
                        {provider.name} ({provider.provider})
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Model: {provider.model}
                        {provider.isDefault && ' (Default)'}
                      </Typography>
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {aiProviders.length === 0 && (
              <Alert severity="warning" sx={{ mt: 2 }}>
                No AI configurations found. Please set up at least one AI configuration 
                in the Settings page before creating a story.
              </Alert>
            )}

            <Card sx={{ mt: 3, bgcolor: 'background.default' }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Story Summary
                </Typography>
                
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <Typography variant="body2" color="text.secondary">Title:</Typography>
                    <Typography variant="body1">{formData.title || 'Untitled'}</Typography>
                  </Grid>
                  
                  <Grid item xs={12} md={6}>
                    <Typography variant="body2" color="text.secondary">Genre:</Typography>
                    <Typography variant="body1">{formData.genre || 'None selected'}</Typography>
                  </Grid>
                  
                  <Grid item xs={12} md={6}>
                    <Typography variant="body2" color="text.secondary">Length:</Typography>
                    <Typography variant="body1">
                      ~{formData.storyLength.toLocaleString()} words, {formData.chapterCount} chapters
                    </Typography>
                  </Grid>
                  
                  <Grid item xs={12} md={6}>
                    <Typography variant="body2" color="text.secondary">Style:</Typography>
                    <Typography variant="body1">
                      {formData.writingStyle}, {formData.pointOfView}
                    </Typography>
                  </Grid>
                  
                  <Grid item xs={12}>
                    <Typography variant="body2" color="text.secondary">Premise:</Typography>
                    <Typography variant="body1">
                      {formData.premise || 'No premise provided'}
                    </Typography>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Box>
        );

      default:
        return null;
    }
  };

  if (!user) {
    return (
      <Alert severity="warning">
        Please log in to create a story.
      </Alert>
    );
  }

  return (
    <Box sx={{ maxWidth: 1000, mx: 'auto', p: 3 }}>
      <Typography variant="h4" component="h1" gutterBottom align="center">
        Create New Story
      </Typography>
      
      <Typography variant="body1" color="text.secondary" align="center" gutterBottom>
        Follow the steps below to set up your AI-powered story generation
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Card sx={{ mt: 4 }}>
        <CardContent>
          <Stepper activeStep={activeStep} orientation="vertical">
            {steps.map((step, index) => (
              <Step key={step.label}>
                <StepLabel
                  icon={step.icon}
                  optional={
                    index === steps.length - 1 ? (
                      <Typography variant="caption">Last step</Typography>
                    ) : null
                  }
                >
                  <Typography variant="h6">{step.label}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {step.description}
                  </Typography>
                </StepLabel>
                <StepContent>
                  <Box sx={{ mt: 2 }}>
                    {renderStepContent(index)}
                    
                    <Box sx={{ mt: 3, display: 'flex', gap: 1 }}>
                      <Button
                        disabled={index === 0}
                        onClick={handleBack}
                        sx={{ mr: 1 }}
                      >
                        Back
                      </Button>
                      
                      {index === steps.length - 1 ? (
                        <Button
                          variant="contained"
                          onClick={handleSubmit}
                          disabled={!isStepValid(index) || loading || aiProviders.length === 0}
                          startIcon={loading ? <CircularProgress size={20} /> : null}
                        >
                          {loading ? 'Creating Story...' : 'Create Story'}
                        </Button>
                      ) : (
                        <Button
                          variant="contained"
                          onClick={handleNext}
                          disabled={!isStepValid(index)}
                        >
                          Continue
                        </Button>
                      )}
                    </Box>
                  </Box>
                </StepContent>
              </Step>
            ))}
          </Stepper>
        </CardContent>
      </Card>
    </Box>
  );
}