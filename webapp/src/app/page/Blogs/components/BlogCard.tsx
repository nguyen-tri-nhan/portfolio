import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardMedia from '@mui/material/CardMedia';
import Typography from '@mui/material/Typography';
import { CardActionArea, styled } from '@mui/material';
import { GithubFile } from '../../../model/github';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';

type BlogCardProps = GithubFile;

export default function BlogCard({ name, thumbnail }: BlogCardProps) {

  const StyledCard = styled(Card)`
  margin: 16px 0;
  &:not(:last-child) {
    margin-right: 16px;
  }
  `;

  const [thumnailSrc, setThumbnailSrc] = useState<string>(thumbnail?.thumbnail ?? thumbnail?.fallback ?? '');

  const path = `/blogs/${name}`;
  const navigate = useNavigate();

  return (
    <StyledCard key={name} sx={{ maxWidth: 345 }}>
      <CardActionArea onClick={() => navigate(path)}>
        <CardMedia
          component="img"
          image={thumnailSrc}
          alt={name}
          onError={() => setThumbnailSrc(thumbnail?.fallback ?? '')}
          sx={{
            width: '250px !important',
            height: '150px !important',
          }}
        />
        <CardContent>
          <Typography gutterBottom variant="h5" component="div">
            {name}
          </Typography>
        </CardContent>
      </CardActionArea>
    </StyledCard>
  );
}
