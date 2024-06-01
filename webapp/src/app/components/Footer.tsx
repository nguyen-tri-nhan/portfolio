import React from 'react';
import { IconButton, styled } from '@mui/material';
import { Facebook, GetApp, GitHub, LinkedIn } from '@mui/icons-material';

const FooterContainer = styled('footer')`
    background-color: ${({ theme }) => theme.palette.primary.main};
    color: ${({ theme }) => theme.palette.primary.contrastText};
    padding: ${({ theme }) => theme.spacing(2)};
    display: flex;
    justify-content: center;
    align-items: center;
`;

const StyledIconButton = styled(IconButton)`
    margin: ${({ theme }) => theme.spacing(1)};
`;

const Footer: React.FC = () => {
  return (
    <FooterContainer>
      <StyledIconButton
        color="inherit"
        rel="noopener"
      >
        <GitHub />
      </StyledIconButton>
      <StyledIconButton
        color="inherit"
        rel="noopener"
      >
        <Facebook />
      </StyledIconButton>
      <StyledIconButton
        color="inherit"
        rel="noopener"
      >
        <LinkedIn />
      </StyledIconButton>
      <StyledIconButton
        color="inherit"
      >
        <GetApp />
      </StyledIconButton>
    </FooterContainer>
  );
};

export default Footer;
