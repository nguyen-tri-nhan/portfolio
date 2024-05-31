import { PropsWithChildren } from "react";
import Navigationbar from "./Navigationbar";

export const AppLayout: React.FC<PropsWithChildren> = ({ children }) => {
  return (
    <div>
      <Navigationbar />
      <div>
        {children}
      </div>
    </div>
  )
};