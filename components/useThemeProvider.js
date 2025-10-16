import { ThemeProvider } from "next-themes";
import React from "react";

const UseThemeProvider = ({ children }) => {
  return <ThemeProvider>{children}</ThemeProvider>;
};

export default UseThemeProvider;
