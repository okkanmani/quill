import { createContext, useContext } from "react";

const ShellLayoutContext = createContext({
  sidebarCollapsed: false,
  setSidebarCollapsed: () => {},
  toggleSidebar: () => {},
});

export function useShellLayout() {
  return useContext(ShellLayoutContext);
}

export default ShellLayoutContext;
