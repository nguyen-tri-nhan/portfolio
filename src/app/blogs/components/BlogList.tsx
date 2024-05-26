"use client";
import { fetchGitHubContent } from '@/app/apis/github';
import { GithubFile } from '@/app/apis/model/github';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link'


const folderName = 'blogs';

const BlogList: React.FC = () => {
  const [blogs, setBlogs] = useState<GithubFile[] | null>(null);
  const router = useRouter()


  const fetchBlogs = () => {
    fetchGitHubContent(folderName).then((res) => {
      setBlogs(res);
    });
  }

  useEffect(() => {
    fetchBlogs();
  }, []);

  const renderCategories = () => {
    return blogs?.map((blog) => {
      return (
        <div key={blog.sha}>
          <Link href={`/blogs/${encodeURIComponent(blog.name)}`}>
            <h2>{blog.name}</h2>
          </Link>
        </div>
      );
    });
  };

  return (
    <div>
      {blogs ? renderCategories() : (
        <p>Loading category...</p>
      )}
    </div>
  );
};

export default BlogList;