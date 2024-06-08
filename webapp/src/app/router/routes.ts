import { RouteObject } from "react-router-dom";
import Home from "../page/Home";
import Blogs from "../page/Blogs";
import { RootRoutes } from "./RootRoutes";
import BlogDetails from "../page/BlogDetails";
import Projects from "../page/Projects";
import About from "../page/About";

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
  },
  {
    path: '/projects',
    Component: Projects,
  },
  {
    path: '/about',
    Component: About,
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
