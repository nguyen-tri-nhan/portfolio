import { Typography, styled } from '@mui/material';
import { AboutCover } from './AboutCover';
import { Experience } from './Experience';

const Container = styled('div')({
  img: {
    maxWidth: '100%',
    borderRadius: '8px',
  },
  maxWidth: '100vw',
});

const StyledTypography = styled(Typography)({
  margin: '16px 0',
});

const About: React.FC = () => {

  return (
    <Container>
      <AboutCover />
      <StyledTypography variant="h3">About Me</StyledTypography>
      <StyledTypography variant="body1">
        I am a Full Stack Software Engineer with a passion for building high-quality software applications.
        I have experience working with a variety of technologies and frameworks, including Java, JavaScript and Python.
        I am always looking to learn new things and improve my skills as a developer.
      </StyledTypography>
      <StyledTypography variant="h3">Experience</StyledTypography>
      <Experience />
    </Container>
  );
};

export default About;