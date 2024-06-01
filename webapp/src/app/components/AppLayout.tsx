import { PropsWithChildren } from "react";
import Navigationbar from "./Navigationbar";
import { Container, styled } from "@mui/material";
import useMediaQuery from '@mui/material/useMediaQuery';
import Footer from "./Footer";


export const AppLayout: React.FC<PropsWithChildren> = ({ children }) => {

  const isMobile = useMediaQuery('(max-width:600px)');

  const AppContainer = styled('div')`
    margin-top: 64px;
    min-height: calc(100vh - 64px);
  `;
  return (
    <div>
      <Navigationbar />
      <AppContainer>
        <Container maxWidth={isMobile ? 'xl' : 'lg'}>
          {children}
        </Container>
      </AppContainer>
      <Footer />
    </div>
  )
};