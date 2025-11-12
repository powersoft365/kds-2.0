"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Settings,
  Search,
  Menu,
  ChevronDown,
  X,
  Moon,
  Loader2,
  LogIn,
  LogOut,
  Type,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";

import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

/**
 * Header with Department filter + dynamic Login/Logout behavior + Font Size dropdown (with extra small)
 */
export function Header({
  currentTime,
  headerTabs = [],
  activeTab,
  setActiveTab,
  counts = {},
  searchTerm,
  setSearchTerm,
  t = (k) => k,
  departments = [],
  selectedDepts = [],
  toggleDept = () => {},
  setSettingsDialog = () => {},
  departmentMap = new Map(),
}) {
  const router = useRouter();
  const [isMobileTrayOpen, setIsMobileTrayOpen] = React.useState(false);
  const [activeLoadingDept, setActiveLoadingDept] = React.useState(null);
  const [hasToken, setHasToken] = React.useState(false);
  const [isLogoutOpen, setIsLogoutOpen] = React.useState(false);
  const [fontSize, setFontSize] = React.useState("medium");

  React.useEffect(() => {
    const token = localStorage.getItem("ps365_token");
    setHasToken(!!token);

    const savedFontSize = localStorage.getItem("fontSizePref") || "medium";
    setFontSize(savedFontSize);
    applyFontSize(savedFontSize);
  }, []);

  const applyFontSize = (size) => {
    const html = document.documentElement;
    if (size === "xsmall") html.style.fontSize = "12px";
    else if (size === "small") html.style.fontSize = "14px";
    else if (size === "large") html.style.fontSize = "18px";
    else html.style.fontSize = "16px";
  };

  const handleFontChange = (size) => {
    setFontSize(size);
    localStorage.setItem("fontSizePref", size);
    applyFontSize(size);
  };

  const isLocked = activeLoadingDept !== null;

  const onToggleMobileTray = () => setIsMobileTrayOpen((v) => !v);

  // sort departments alphabetically; keep "All" first
  const sortedDepartments = React.useMemo(() => {
    const list = Array.isArray(departments) ? [...departments] : [];
    const hasAll = list.includes("All");
    const rest = list
      .filter((d) => d !== "All")
      .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
    return hasAll ? ["All", ...rest] : rest;
  }, [departments]);

  const selectedCount = React.useMemo(() => {
    const isAll = selectedDepts.includes("All");
    return isAll ? 1 : selectedDepts?.length || 0;
  }, [selectedDepts]);

  const isPromise = (p) =>
    !!p &&
    (typeof p === "object" || typeof p === "function") &&
    typeof p.then === "function";

  const handleToggleDept = (dept) => {
    if (isLocked && activeLoadingDept !== dept) return;
    setActiveLoadingDept(dept);

    const code = departmentMap.get(dept);
    if (code) console.log(`Department selected: ${dept} (Code: ${code})`);

    try {
      const result = toggleDept(dept);
      if (isPromise(result)) {
        Promise.resolve(result)
          .catch(() => {})
          .finally(() => setActiveLoadingDept(null));
      } else {
        setTimeout(() => setActiveLoadingDept(null), 450);
      }
    } catch {
      setActiveLoadingDept(null);
    }
  };

  /* ---------- Department Pills ---------- */
  const DeptPills = (
    <div className="flex items-center">
      <div className="flex gap-1 bg-muted/70 rounded-md p-1 overflow-x-auto scrollbar-thin scrollbar-thumb-muted-foreground/30 scrollbar-track-transparent md:overflow-visible">
        {sortedDepartments.map((d) => {
          const isActive = selectedDepts.includes(d);
          const isThisLoading = activeLoadingDept === d;
          const disabled = isLocked;
          return (
            <Button
              key={d}
              size="sm"
              variant={isActive ? "default" : "ghost"}
              onClick={() => handleToggleDept(d)}
              className={`${
                isActive ? "" : "text-muted-foreground"
              } whitespace-nowrap inline-flex items-center gap-1`}
              aria-pressed={isActive}
              aria-busy={isThisLoading}
              disabled={disabled}
            >
              {isThisLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>{d}</span>
            </Button>
          );
        })}
      </div>
    </div>
  );

  /* ---------- Department Dropdown ---------- */
  const DeptDropdown = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="secondary" size="sm" className="gap-0">
          {selectedDepts?.length === 0 ? (
            <span className="text-[11px] opacity-80">Tag List</span>
          ) : (
            <>
              {selectedDepts?.map((d, idx) => (
                <span key={idx} className="text-[11px] opacity-80">
                  {d}
                  {idx < selectedDepts.length - 1 ? ", " : ""}
                </span>
              ))}
            </>
          )}

          <Badge variant="secondary" className="ml-1">
            {selectedCount}
          </Badge>
          <ChevronDown className="w-4 h-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side="bottom" className="w-56">
        <DropdownMenuLabel>Filter by Department</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {sortedDepartments.map((d) => {
          const isThisLoading = activeLoadingDept === d;
          const disabled = isLocked;
          return (
            <DropdownMenuCheckboxItem
              key={d}
              checked={selectedDepts.includes(d)}
              onSelect={(e) => e.preventDefault()}
              onCheckedChange={() => handleToggleDept(d)}
              className={`cursor-pointer ${disabled ? "opacity-80" : ""}`}
              disabled={disabled}
            >
              <span className="inline-flex items-center gap-2">
                {isThisLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>{d}</span>
              </span>
            </DropdownMenuCheckboxItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  /* ---------- Font Size Dropdown ---------- */
  const FontSizeDropdown = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Font size settings">
          <Type className="w-5 h-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side="bottom" className="w-40">
        <DropdownMenuLabel>Text Size</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {["xsmall", "small", "medium", "large"].map((size) => (
          <DropdownMenuCheckboxItem
            key={size}
            checked={fontSize === size}
            onSelect={(e) => e.preventDefault()}
            onCheckedChange={() => handleFontChange(size)}
          >
            {size === "xsmall"
              ? "Extra Small"
              : size.charAt(0).toUpperCase() + size.slice(1)}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  /* ---------- Logout Confirmation Modal ---------- */
  const LogoutDialog = (
    <Dialog open={isLogoutOpen} onOpenChange={setIsLogoutOpen}>
      <DialogTrigger asChild>
        <Button
          variant="destructive"
          size="icon"
          aria-label="Logout"
          onClick={(e) => {
            e.preventDefault();
            setIsLogoutOpen(true);
          }}
        >
          <LogOut className="w-5 h-5" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirm Logout</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Are you sure you want to log out from Baresto Pro?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex justify-end gap-2 mt-4">
          <Button
            variant="outline"
            onClick={() => setIsLogoutOpen(false)}
            className="min-w-[90px]"
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            className="min-w-[90px]"
            onClick={() => {
              localStorage.removeItem("ps365_token");
              localStorage.removeItem("cred");
              setHasToken(false);
              setIsLogoutOpen(false);
              router.push("/login");
            }}
          >
            Yes, Logout
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  /* ---------- Header UI ---------- */
  return (
    <header
      className="w-full border-b bg-background sticky top-0 z-30"
      style={{ borderBottomWidth: 3 }}
      aria-busy={isLocked}
    >
      {/* Thin loader bar */}
      <div
        className={`h-0.5 ${
          isLocked ? "bg-primary animate-pulse" : "bg-transparent"
        }`}
      />

      <div className="flex px-4 h-[60px] md:h-[65px] items-center justify-between gap-2 md:gap-3">
        {/* Brand */}
        <div className="flex items-center gap-3 md:gap-4 min-w-0">
          <h1 className="tracking-widest font-extrabold text-lg md:text-xl lg:text-2xl truncate">
            Baresto Pro
          </h1>
          <div className="text-muted-foreground text-[12px] md:text-sm min-w-[80px] md:min-w-[90px] whitespace-nowrap">
            {currentTime}
          </div>
        </div>

        {/* Tabs (desktop) */}
        <nav className="hidden md:flex items-stretch gap-1">
          {headerTabs.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`relative font-bold text-sm md:text-base px-3 lg:px-4 h-[60px] md:h-[65px] -mb-[3px] border-b-4 transition-colors ${
                  isActive
                    ? "border-blue-600 text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground/80"
                }`}
              >
                <span>{tab.label}</span>
                <span className="ml-2 inline-flex align-middle">
                  <Badge variant="secondary" className="font-bold">
                    {Number.isFinite(counts?.[tab.key]) ? counts[tab.key] : 0}
                  </Badge>
                </span>
              </button>
            );
          })}
        </nav>

        {/* Right-side actions */}
        <div className="flex items-center gap-2 md:gap-3">
          {/* Search */}
          <div className="relative hidden md:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={t("search_placeholder")}
              className="pl-9 w-[200px] md:w-[250px]"
            />
          </div>

          {/* Departments */}
          <div className="hidden lg:block">
            {sortedDepartments.length <= 5 ? DeptPills : DeptDropdown}
          </div>

          {/* Font Size */}
          {FontSizeDropdown}

          {/* Settings */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSettingsDialog(true)}
            aria-label="Open settings"
          >
            <Moon className="w-5 h-5" />
          </Button>

          {/* Login / Logout */}
          {!hasToken ? (
            <Link href="/login">
              <Button variant="default" size="icon" aria-label="Login">
                <LogIn className="w-5 h-5" />
              </Button>
            </Link>
          ) : (
            LogoutDialog
          )}

          {/* Mobile toggle */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={onToggleMobileTray}
          >
            {isMobileTrayOpen ? (
              <X className="w-5 h-5" />
            ) : (
              <Menu className="w-5 h-5" />
            )}
          </Button>
        </div>
      </div>
    </header>
  );
}
