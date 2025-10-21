"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
export default function Layout({ children }) {
  const router = useRouter();
  useEffect(() => {
    if (localStorage.getItem("ps365_token")) {
      router.replace("/");
    }
  }, []);
  return <>{children}</>;
}
