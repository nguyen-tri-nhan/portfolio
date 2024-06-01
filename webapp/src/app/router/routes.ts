import { RouteObject } from "react-router-dom";
import Home from "../page/Home";
import Blogs from "../page/Blogs";
import { RootRoutes } from "./RootRoutes";
import BlogDetails from "../page/BlogDetails";

const contentRoutes: RouteObject[] = [
  {
    path: '/',
    Component: Home,
  },
  {
    path: '/blogs',
    Component: Blogs,
  },
  {
    path: '/blogs/:name',
    Component: BlogDetails,
  }
];

export const routes: RouteObject[] = [
  {
    Component: RootRoutes,
    children: [
      ...contentRoutes,
    ]
  },
];
