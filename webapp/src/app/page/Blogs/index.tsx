import React, { useCallback, useEffect } from 'react';
import { GithubFile } from '../../model/github';
import { getPosts } from '../../apis';
import { Category } from '../../utils/contants';
import { Helmet } from 'react-helmet';
import BlogCard from './components/BlogCard';
import { Typography, styled } from '@mui/material';

const Blogs: React.FC = () => {
  const [blogs, setBlogs] = React.useState<GithubFile[]>([]);


  const getBlogs = useCallback(async () => {
    const res = await getPosts({ category: Category.BLOGS });
    if (res) {
      setBlogs(res);
    }
  }, []);

  useEffect(() => {
    getBlogs();
  }, [getBlogs]);

  // for debug and styling
  // const duplicateBlogs = Array.from({ length: 20 }, (_, index) => index + 1).map((index) => (
  //   <BlogCard key={index} {...blogs[index % blogs.length]} />
  // ));

  const renderBlogs = blogs.map((blog: GithubFile) => (
    <BlogCard {...blog} />
  ));

  const BlogsContainer = styled('div')`
  display: flex;
  flex-wrap: wrap;
  `

  return (
    <div>
      <Helmet>
        <title>Blogs</title>
      </Helmet>
      <Typography variant="h4" component="h1" gutterBottom>
        Blogs
      </Typography>
      <>
        <Typography variant="h6" component="h2" gutterBottom>
          Fun Things
        </Typography>
        <Typography variant="body2" component="p" gutterBottom>
          I love to have fun and enjoy life. Here are some fun things I've experienced:
        </Typography>
        <ul>
          <li>Play something in my company</li>
          <li>Join a ceremonies</li>
          <li>Exploring some technical skills</li>
          <li>Some of my funny side works</li>
        </ul>
      </>
      <BlogsContainer>
        {renderBlogs}
      </BlogsContainer>
    </div >
  );
}

export default Blogs;