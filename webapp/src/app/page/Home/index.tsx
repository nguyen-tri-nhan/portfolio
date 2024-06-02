import React, { useState, useEffect } from 'react';
import { Box } from '@mui/system';
import { styled } from '@mui/material/styles';
import Overlay from './components/Overlay';
import { Helmet } from 'react-helmet';
import Cover from './components/Cover';

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
        <Cover />
      )}
    </HomePageContainer>
  );
};

export default Home;
