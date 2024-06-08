import React, { useCallback, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { getPostContent } from '../../apis';
import ReactMarkdown from 'react-markdown';
import { styled } from '@mui/material';
import ContentSkeleton from './components/ContentSkeleton';

const Markdown = styled(ReactMarkdown)({
  img: {
    maxWidth: '100%',
  },
});

const BlogDetails: React.FC = () => {
  const { name } = useParams<{ name: string }>();
  const [content, setContent] = React.useState<string>('');
  const [loading, setLoading] = React.useState<boolean>(true);

  const fetchBlogContent = useCallback(async () => {
    if (!name) return;
    const res = await getPostContent({ category: 'blogs', fileName: name });
    if (!res) return;
    setContent(res);
    setLoading(false);
  }, [name]);

  useEffect(() => {
    fetchBlogContent();
  }, [fetchBlogContent]);

  return loading ? (
    <ContentSkeleton />
  ) : (
    <Markdown>
      {content}
    </Markdown>
  );
};

export default BlogDetails;