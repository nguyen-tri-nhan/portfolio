import { PropsWithChildren } from "react";
import ReactMarkdown, { Components } from 'react-markdown';
import { Typography, styled } from '@mui/material';
import LazyLoadImage from "./Image";

const StyledMarkdown = styled(ReactMarkdown)({
  img: {
    maxWidth: '100%',
    borderRadius: '8px',
  },
});

type ReactMarkdownProps = PropsWithChildren & {
  children?: string | null;
};

const StyledMarkdownTypography = styled(Typography)({
  margin: '16px 0',
});

const Markdown: React.FC<ReactMarkdownProps> = ({ children }) => {

  const components: Partial<Components> = {
    h1: ({ children }) => <StyledMarkdownTypography variant="h3">{children}</StyledMarkdownTypography>,
    h2: ({ children }) => <StyledMarkdownTypography variant="h4">{children}</StyledMarkdownTypography>,
    h3: ({ children }) => <StyledMarkdownTypography variant="h5">{children}</StyledMarkdownTypography>,
    h4: ({ children }) => <StyledMarkdownTypography variant="h6">{children}</StyledMarkdownTypography>,
    p: ({ children }) => <StyledMarkdownTypography variant="body1">{children}</StyledMarkdownTypography>,
    img: ({ src, alt }) => <LazyLoadImage src={src} alt={alt} />,
  };

  return (
    <StyledMarkdown
      components={components}
    >
      {children}
    </StyledMarkdown>
  );
}

export default Markdown;