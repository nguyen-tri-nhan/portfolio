import React from 'react';
import Skeleton from '@mui/material/Skeleton';
import { Card, CardActionArea, CardContent, styled } from '@mui/material';

const StyledCard = styled(Card)`
margin: 16px 0;
&:not(:last-child) {
  margin-right: 16px;
}
`;

const BlogCardSkeleton: React.FC = () => {
  return (
    <StyledCard sx={{ maxWidth: 345 }}>
      <CardActionArea>
        <Skeleton variant="rectangular" width={250} height={150} />
        <CardContent>
          <Skeleton variant="text" width={150} height={30} />
        </CardContent>
      </CardActionArea>
    </StyledCard>
  );
};

export default BlogCardSkeleton;