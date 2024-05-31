import { RouteObject } from "react-router-dom";
import Home from "../page/Home";
import Blogs from "../page/Blogs";
import { RootRoutes } from "./RootRoutes";

const contentRoutes: RouteObject[] = [
  {
    path: '/',
    Component: Home,
  },
  {
    path: '/blogs',
    Component: Blogs,
  },
];

export const routes: RouteObject[] = [
  {
    Component: RootRoutes,
    children: [
      ...contentRoutes,
    ]
  },
];
