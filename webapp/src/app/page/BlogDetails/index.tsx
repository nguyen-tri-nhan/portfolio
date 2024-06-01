import React, { useCallback, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { getPostContent } from '../../apis';
import ReactMarkdown from 'react-markdown';
import { styled } from '@mui/material';

const Markdown = styled(ReactMarkdown)({
  img: {
    maxWidth: '100%',
  },
});

const BlogDetails: React.FC = () => {
  const { name } = useParams<{ name: string }>();
  const [content, setContent] = React.useState<string>('');

  const fetchBlogContent = useCallback(async () => {
    if (!name) return;
    const res = await getPostContent({ category: 'blogs', fileName: name });
    if (!res) return;
    setContent(res);
  }, [name]);

  useEffect(() => {
    fetchBlogContent();
  }, [fetchBlogContent]);

  return (
    <Markdown>
      {content}
    </Markdown>
  );
};

export default BlogDetails;