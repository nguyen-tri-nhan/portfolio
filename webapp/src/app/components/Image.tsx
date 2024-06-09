import { Skeleton, Typography } from "@mui/material";
import { useState } from "react";

type LazyLoadImageProps = {
  src?: string;
  alt?: string;
  hideCaption?: boolean;
};

const LazyLoadImage: React.FC<LazyLoadImageProps> = ({ src, alt, hideCaption = false }) => {
  const [imageLoaded, setImageLoaded] = useState(false);

  return (
    <>
      <Skeleton
        variant="rectangular"
        width="100%"
        height="200px"
        animation="wave"
        style={{ display: imageLoaded ? 'none' : 'block' }}
      />
      <img
        src={src}
        alt={alt}
        onLoad={() => setImageLoaded(true)}
        style={{ display: imageLoaded ? 'block' : 'none' }} />
      {
        !hideCaption && (
          <Typography
            variant="subtitle1"
            style={{
              textAlign: 'center',
            }}>
            {alt}
          </Typography>
        )
      }
    </>
  )
}

export default LazyLoadImage;