export type NavItem = {
  name: string;
  path: string;
};

export const navItems: NavItem[] = [
  {
    name: "navigation.home",
    path: "/",
  },
  {
    name: "navigation.projects",
    path: "/projects",
  },
  {
    name: "navigation.blogs",
    path: "/blogs",
  },
  {
    name: "navigation.about",
    path: "/about",
  },
];
