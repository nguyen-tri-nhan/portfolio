import { Skeleton, Typography } from "@mui/material";
import { useState } from "react";

const LazyLoadImage: React.FC<{ src?: string, alt?: string }> = ({ src, alt }) => {
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
      <Typography
        variant="subtitle1"
        style={{
          textAlign: 'center',
        }}>
        {alt}
      </Typography>
    </>
  )
}

export default LazyLoadImage;