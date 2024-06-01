import React, { useState, useEffect } from 'react';
import { Box } from '@mui/system';
import { styled } from '@mui/material/styles';
import Overlay from './Overlay';
import { Helmet } from 'react-helmet';

const HomePageContainer = styled(Box)`
  position: relative;
`;

const Home: React.FC = () => {
  const [showOverlay, setShowOverlay] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setShowOverlay(false), 3000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <HomePageContainer>
      <Helmet>
        <title>Nhan Nguyen</title>
      </Helmet>
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
