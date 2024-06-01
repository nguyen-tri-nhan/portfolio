import { PropsWithChildren } from "react";
import Navigationbar from "./Navigationbar";
import { Container, styled } from "@mui/material";
import useMediaQuery from '@mui/material/useMediaQuery';


export const AppLayout: React.FC<PropsWithChildren> = ({ children }) => {

  const isMobile = useMediaQuery('(max-width:600px)');

  const AppContainer = styled('div')`
    margin-top: 64px;
  `;
  return (
    <div>
      <Navigationbar />
      <AppContainer>
        <Container maxWidth={isMobile ? 'xl' : 'lg'}>
          {children}
        </Container>
      </AppContainer>
    </div>
  )
};