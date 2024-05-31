import { Outlet } from "react-router-dom";
import { AppLayout } from "../components/AppLayout";

export const RootRoutes: React.FC = () => {
  return (
    <AppLayout>
      <Outlet />
    </AppLayout>
  )
};