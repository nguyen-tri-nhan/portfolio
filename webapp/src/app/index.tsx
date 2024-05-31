import React from 'react';

import AppProvider from './AppProvider';
import { RouteProvider } from './AppProvider/RouteProvider';

const App: React.FC = () => {
  return (
    <AppProvider>
      <RouteProvider />
    </AppProvider>
  );
};


export default App;
