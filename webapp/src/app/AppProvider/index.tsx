import React, { PropsWithChildren } from 'react';

const AppProvider: React.FC<PropsWithChildren> = ({ children }) => {
    return <>{children}</>;
};

export default AppProvider;