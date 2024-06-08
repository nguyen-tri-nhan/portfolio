import { ThemeProvider } from '@emotion/react';
import React, { PropsWithChildren } from 'react';
import theme from './theme';
import { Provider as ReduxProvider } from 'react-redux';
import store from '../redux/store';

const AppProvider: React.FC<PropsWithChildren> = ({ children }) => {
  let node = children;
  node = <ThemeProvider theme={theme}>{node}</ThemeProvider>;
  node = <ReduxProvider store={store}>{node}</ReduxProvider>
  return node;
};

export default AppProvider;