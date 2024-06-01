import { ThemeProvider } from '@emotion/react';
import React, { PropsWithChildren } from 'react';
import theme from './theme';

const AppProvider: React.FC<PropsWithChildren> = ({ children }) => {
  let node = children;
  node = <ThemeProvider theme={theme}>{node}</ThemeProvider>;
  return node;
};

export default AppProvider;