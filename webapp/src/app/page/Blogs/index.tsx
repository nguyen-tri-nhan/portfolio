import React, { useCallback, useEffect } from 'react';
import { GithubFile } from '../../model/github';
import { getPosts } from '../../apis';
import { Category } from '../../utils/contants';
import { Link } from 'react-router-dom';

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

  const renderBlogs = () => blogs.map((blog: GithubFile) => (
    <Link to={`/blogs/${blog.name}`} key={blog.name}>
      {blog.name}
    </Link>
  ));

  return (
    <div>
      Blog
      {renderBlogs()}
    </div>
  );
}

export default Blogs;