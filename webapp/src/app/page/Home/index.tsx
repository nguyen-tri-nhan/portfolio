import React, { useState, useEffect } from 'react';
import { Box } from '@mui/system';
import { styled } from '@mui/material/styles';
import Overlay from './Overlay';

const HomePageContainer = styled(Box)`
  position: relative;
`;

const Home: React.FC = () => {
  const [showOverlay, setShowOverlay] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setShowOverlay(false), 2000); // Adjust timing if necessary
    return () => clearTimeout(timer);
  }, []);

  return (
    <HomePageContainer>
      <Overlay show={showOverlay} />
      {/* Your main content goes here */}
      {!showOverlay && (
        <>
          <h1>Welcome to My Website</h1>
          <p>This is the homepage content.</p>
        </>
      )}
    </HomePageContainer>
  );
};

export default Home;
