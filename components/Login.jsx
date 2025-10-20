"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, Lock } from "lucide-react";
import { Toast } from "./Toast"; // app/kds-pro/components/Toast.jsx

function AnimatedKDSLogo() {
  return (
    <div className="mx-auto mb-2 flex items-center justify-center">
      <svg
        className="h-12 w-12 text-purple-500 drop-shadow-sm"
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M8 40c0-13.255 10.745-24 24-24s24 10.745 24 24"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="[stroke-dasharray:160] [stroke-dashoffset:160] animate-[dash_1.6s_ease-in-out_forwards]"
        />
        <circle
          cx="32"
          cy="14"
          r="3"
          stroke="currentColor"
          strokeWidth="3"
          className="[stroke-dasharray:40] [stroke-dashoffset:40] animate-[dash_1s_.2s_ease-in-out_forwards]"
        />
        <path
          d="M6 44h52"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          className="[stroke-dasharray:80] [stroke-dashoffset:80] animate-[dash_1s_.7s_ease-in-out_forwards]"
        />
        <path
          d="M22 22c2 3 0 5-2 8m10-8c2 3 0 5-2 8m10-8c2 3 0 5-2 8"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          className="opacity-70 animate-[steam_2.4s_.8s_ease-in-out_infinite]"
        />
      </svg>

      <style jsx>{`
        @keyframes dash {
          to {
            stroke-dashoffset: 0;
          }
        }
        @keyframes steam {
          0% {
            opacity: 0.2;
            transform: translateY(0);
          }
          50% {
            opacity: 0.9;
            transform: translateY(-4px);
          }
          100% {
            opacity: 0.2;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isValid, setIsValid] = useState(false);

  useEffect(() => {
    setIsValid(username.trim() !== "" && password.trim() !== "");
  }, [username, password]);

  const emitToast = ({ message, variant = "info", action, major = false }) => {
    toast.custom(() => (
      <Toast
        message={message}
        variant={variant}
        action={action}
        major={major}
      />
    ));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!username || !password) {
      emitToast({
        message: "Please enter both username and password.",
        variant: "warning",
        action: "settings.changed",
      });
      return;
    }

    setIsLoading(true);

    try {
      // keep the API URL as-is
      const res = await fetch("/api/authentication/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      let result = null;
      try {
        result = await res.json();
      } catch (_) {
        result = null;
      }
      console.log(result);
      // Handle APIs that wrap app-level status in body fields
      const apiCode =
        result?.data?.response_code ?? result?.response_code ?? result?.code;

      const apiMsg =
        result?.data?.response_msg ||
        result?.response_msg ||
        result?.message ||
        "Unable to login. Please try again.";

      if (String(apiCode) === "200") {
        emitToast({
          message: "Welcome back!",
          variant: "success",
          action: "order.complete",
          major: true,
        });
        router.push("/select-context");
      } else {
        // e.g. response_code "302" with "Invalid requested password"
        emitToast({
          message: apiMsg,
          variant: "error",
          action: "order.item.cancelled",
          major: true,
        });
      }
    } catch (error) {
      emitToast({
        message: "Authentication failed. Please try again.",
        variant: "error",
        action: "order.undo",
        major: true,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const buttonLabel = isLoading ? "Logging in..." : "Login";

  return (
    // OUTER container: no max-w and no px padding
    <div className="relative min-h-screen bg-background text-foreground overflow-hidden">
      {/* background accents (non-interactive) */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full blur-3xl opacity-30 bg-blue-400/40" />
        <div className="absolute -bottom-24 -right-24 h-80 w-80 rounded-full blur-3xl opacity-30 bg-purple-400/40" />
      </div>

      <div className="relative z-10 flex items-center justify-center min-h-screen">
        {/* inner wrapper sizes itself; no px on outer container */}
        <div className="w-full sm:w-[420px]">
          <Card className="backdrop-blur supports-[backdrop-filter]:bg-background/80 shadow-xl">
            <CardHeader className="text-center space-y-2">
              <AnimatedKDSLogo />
              <h1 className="text-2xl font-bold tracking-tight">KDS Login</h1>
              <p className="text-sm text-muted-foreground">
                Kitchen Display System
              </p>
            </CardHeader>

            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    autoComplete="username"
                    placeholder="Enter your username"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">
                      <Lock className="h-4 w-4" />
                    </span>
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-9 pr-10"
                      autoComplete="current-password"
                      placeholder="Enter password"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground"
                      aria-label={
                        showPassword ? "Hide password" : "Show password"
                      }
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={!isValid || isLoading}
                  className="relative inline-flex w-full items-center justify-center overflow-hidden rounded-full border-2 border-purple-500 p-4 font-medium text-indigo-600 shadow-md transition duration-300 ease-out group disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
                >
                  <span className="absolute inset-0 flex items-center justify-center h-full w-full -translate-x-full bg-purple-500 text-white duration-300 ease group-hover:translate-x-0">
                    <svg
                      className="h-6 w-6"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M14 5l7 7m0 0l-7 7m7-7H3"
                      />
                    </svg>
                  </span>
                  <span className="absolute flex items-center justify-center h-full w-full text-purple-500 transition-all duration-300 transform ease group-hover:translate-x-full">
                    {buttonLabel}
                  </span>
                  <span className="relative invisible">{buttonLabel}</span>
                </button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
