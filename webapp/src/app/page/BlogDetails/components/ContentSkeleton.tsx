import React from 'react';
import { Skeleton } from '@mui/material';

const ContentSkeleton: React.FC = () => {
  return (
    <div>
      <Skeleton variant="text" height={40} animation="wave" />
      <Skeleton variant="text" height={20} />
      <Skeleton variant="rectangular" height={200} animation="wave" />
      <Skeleton variant="text" height={20} />
      <Skeleton variant="text" height={20} />
    </div>
  );
};

export default ContentSkeleton;