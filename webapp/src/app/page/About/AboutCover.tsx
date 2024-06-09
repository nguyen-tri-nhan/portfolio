import React from 'react';
import { Box, Grid } from '@mui/material';
import Avatar from '../../../assets/Images/ava.jpeg';
import LazyLoadImage from '../../components/Image';
import Typewriter from '../Home/components/Typewriter';
import { useState } from 'react';

export const AboutCover: React.FC = React.memo(() => {
  const [line1Complete, setLine1Complete] = useState(false);
  const [line2Complete, setLine2Complete] = useState(false);
  return (
    <Grid container spacing={2}>
      <Grid item xs={12} sm={6}>
        <LazyLoadImage src={Avatar} alt="Avatar" hideCaption />
      </Grid>
      <Grid item xs={12} sm={6}>
        <Box
          display="flex"
          flexDirection="column"
          alignItems="center"
          justifyContent="center"
          height="100%"
          position="relative" // Ensure the overlay text is positioned relative to its container
          zIndex={1} // Ensure text is above the background
        >
          <Box mb={2}>
            <Typewriter
              text="Hi, I am Nhan Nguyen"
              variant="h4"
              delay={0}
              onTypingComplete={() => setLine1Complete(true)}
              showCursor={!line1Complete}
            />
          </Box>
          {line1Complete && (
            <Box mb={2}>
              <Typewriter
                text="I am a Full Stack Software Engineer"
                variant="h5"
                delay={0}
                onTypingComplete={() => setLine2Complete(true)}
                showCursor={!line2Complete}
              />
            </Box>
          )}
          {line2Complete && (
            <Box mb={2}>
              <Typewriter
                text="Welcome to my portfolio!"
                variant="h5"
                delay={0}
                isLastLine={true}
              />
            </Box>
          )}
        </Box>
      </Grid>
    </Grid>
  );
});