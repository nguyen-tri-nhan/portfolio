import { createTheme } from '@mui/material/styles';
import colors from '../utils/token';

const theme = createTheme({
  palette: {
    primary: {
      main: colors.primaryBlue,
    },
    secondary: {
      main: colors.secondaryBlue,
    },
    background: {
      default: colors.whiteBackground,
    },
    text: {
      primary: colors.blackText,
      secondary: colors.lightBlueText,
    },
    action: {
      active: colors.headingBlue,
      hover: colors.buttonHoverBlue,
    },
    divider: colors.blueBorder,
  },
  typography: {
    h1: {
      color: colors.headingBlue,
    },
    h2: {
      color: colors.headingBlue,
    },
    h3: {
      color: colors.headingBlue,
    },
    h4: {
      color: colors.headingBlue,
    },
    h5: {
      color: colors.headingBlue,
    },
    h6: {
      color: colors.headingBlue,
    },
    body1: {
      color: colors.blackText,
    },
    body2: {
      color: colors.lightBlueText,
    },
    subtitle1: {
      color: colors.lightBlueText,
    },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          backgroundColor: colors.primaryBlue,
          color: colors.whiteBackground,
          '&:hover': {
            backgroundColor: colors.primaryBlueWithOpacity,
          },
        },
      },
    },
    MuiDivider: {
      styleOverrides: {
        root: {
          borderColor: colors.blueBorder,
        },
      },
    },
  },
});

export default theme;
