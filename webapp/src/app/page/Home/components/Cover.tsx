import React, { useState } from 'react';
import { Box } from '@mui/material';
import BinaryBackground from './BinaryBackground';
import Typewriter from './Typewriter';
import { useTranslation } from 'react-i18next';

const HomeCover: React.FC = () => {
  const [line1Complete, setLine1Complete] = useState(false);
  const [line2Complete, setLine2Complete] = useState(false);
  const { t } = useTranslation();

  return (
    <Box position="relative" height="100vh" width="100%">
      <BinaryBackground />
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
            text={t('homePage.cover.line1')}
            variant="h3"
            delay={0}
            onTypingComplete={() => setLine1Complete(true)}
            showCursor={!line1Complete}
          />
        </Box>
        {line1Complete && (
          <Box mb={2}>
            <Typewriter
              text={t('homePage.cover.line2')}
              variant="h4"
              delay={0}
              onTypingComplete={() => setLine2Complete(true)}
              showCursor={!line2Complete}
            />
          </Box>
        )}
        {line2Complete && (
          <Box mb={2}>
            <Typewriter
              text={t('homePage.cover.line3')}
              variant="h5"
              delay={0}
              isLastLine={true}
            />
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default HomeCover;
