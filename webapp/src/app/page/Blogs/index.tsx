import React, { useCallback, useEffect } from 'react';
import { GithubFile } from '../../model/github';
import { Helmet } from 'react-helmet';
import BlogCard from './components/BlogCard';
import { Typography, styled } from '@mui/material';
import { useAppDispatch, useAppSelector } from '../../redux/hook';
import { selectBlogs, selectBlogsLoading } from '../../redux/selectors/blogSelector';
import { fetchBlogs } from '../../redux/slices/blogSlice';
import BlogCardSkeleton from './components/BlogCardSkeleton';

const Blogs: React.FC = () => {
  const dispatch = useAppDispatch();
  const blogs = useAppSelector(selectBlogs);
  const loading = useAppSelector(selectBlogsLoading);

  useEffect(() => {
    dispatch(fetchBlogs());
  }, [dispatch]);

  const renderBlogs = useCallback(() => {
    return blogs.map((blog: GithubFile) => (
      <BlogCard {...blog} />
    ));
  }, [blogs]);

  const renderBlogsLoading = useCallback(() => {
    return Array.from({ length: 8 }).map((_, index) => (
      <BlogCardSkeleton key={index} />
    ));
  }, []);

  const renderContent = useCallback(() => {
    if (!loading) {
      return renderBlogs();
    }
    return renderBlogsLoading();
  }, [loading, renderBlogs, renderBlogsLoading]);


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
        {renderContent()}
      </BlogsContainer>
    </div >
  );
}

export default Blogs;