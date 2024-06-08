import React, { useCallback, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { getPostContent } from '../../apis';

import ContentSkeleton from './components/ContentSkeleton';
import Markdown from '../../components/Markdown';
import { Category } from '../../utils/contants';

const BlogDetails: React.FC = () => {
  const { name } = useParams<{ name: string }>();
  const [content, setContent] = React.useState<string>('');
  const [loading, setLoading] = React.useState<boolean>(true);

  const fetchBlogContent = useCallback(async () => {
    if (!name) return;
    const res = await getPostContent({ category: Category.BLOGS, fileName: name });
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