// app/kds-pro/components/Header.jsx
"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Settings,
  Power,
  Search,
  Menu,
  ChevronDown,
  X,
  Moon,
  Loader2,
} from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";

/**
 * Header with Department filter "lock" behavior:
 * - When you click one department to (re)load orders, that department shows a spinner
 * - ALL OTHER department controls (pills + dropdown items) are disabled until loading finishes
 * - Supports both sync and async toggleDept handlers
 * - Keeps dropdown open while choosing
 * - Departments sorted alphabetically; "All" stays pinned first
 *
 * NOTE (per your global layout rule):
 * - No max-w or any `px-*` padding on the OUTER containers.
 *   Inner elements can use padding as needed.
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
}) {
  const [isMobileTrayOpen, setIsMobileTrayOpen] = React.useState(false);

  // Track the single department currently loading (lock). When set, others are disabled.
  const [activeLoadingDept, setActiveLoadingDept] = React.useState(null);

  const isLocked = activeLoadingDept !== null;

  const onToggleMobileTray = () => setIsMobileTrayOpen((v) => !v);
  const closeMobileTray = () => setIsMobileTrayOpen(false);

  // sort departments alphabetically; keep "All" first
  const sortedDepartments = React.useMemo(() => {
    const list = Array.isArray(departments) ? [...departments] : [];
    const hasAll = list.includes("All");
    const rest = list
      .filter((d) => d !== "All")
      .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
    return hasAll ? ["All", ...rest] : rest;
  }, [departments]);

  // count badge (still useful)
  const selectedCount = React.useMemo(() => {
    const isAll = selectedDepts.includes("All");
    return isAll ? 1 : selectedDepts?.length || 0;
  }, [selectedDepts]);

  const isPromise = (p) =>
    !!p &&
    (typeof p === "object" || typeof p === "function") &&
    typeof p.then === "function";

  // Wrap parent's toggleDept to enforce the "lock others while loading" behavior
  const handleToggleDept = (dept) => {
    // If already locked on another department, do nothing
    if (isLocked && activeLoadingDept !== dept) return;

    // Lock on this department
    setActiveLoadingDept(dept);
    try {
      const result = toggleDept(dept);

      if (isPromise(result)) {
        Promise.resolve(result)
          .catch(() => {
            // swallow to keep UI responsive; in real app you could toast error
          })
          .finally(() => setActiveLoadingDept(null));
      } else {
        // Sync handler — still show a tiny spinner time so the lock feels consistent
        setTimeout(() => setActiveLoadingDept(null), 450);
      }
    } catch {
      setActiveLoadingDept(null);
    }
  };

  const DeptPills = (
    <div className="flex items-center">
      <div className="flex gap-1 bg-muted/70 rounded-md p-1 overflow-x-auto scrollbar-thin scrollbar-thumb-muted-foreground/30 scrollbar-track-transparent md:overflow-visible">
        {sortedDepartments.map((d) => {
          const isActive = selectedDepts.includes(d);
          const isThisLoading = activeLoadingDept === d;
          // While locked, disable everything (including the clicked one to prevent double fires)
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
              aria-label={`Filter by ${d}`}
              aria-busy={isThisLoading}
              disabled={disabled}
            >
              {isThisLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : null}
              <span>{d}</span>
            </Button>
          );
        })}
      </div>
    </div>
  );

  // Dropdown: stays OPEN; trigger label adjusted
  const DeptDropdown = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="secondary"
          size="sm"
          className="gap-2"
          aria-label="Show Department Selection (taglist)"
        >
          <span className="whitespace-nowrap">Show Department Selection</span>
          <span className="text-[11px] opacity-80">(taglist)</span>
          <Badge variant="secondary" className="ml-1">
            {selectedCount}
          </Badge>
          <ChevronDown className="w-4 h-4" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side="bottom" className="w-56">
        <DropdownMenuLabel>Filter by Department</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {sortedDepartments.map((d) => {
          const isThisLoading = activeLoadingDept === d;
          // While locked, all items disabled
          const disabled = isLocked;
          return (
            <DropdownMenuCheckboxItem
              key={d}
              checked={selectedDepts.includes(d)}
              onSelect={(e) => e.preventDefault()} // keep menu open
              onCheckedChange={() => handleToggleDept(d)}
              className={`cursor-pointer ${disabled ? "opacity-80" : ""}`}
              disabled={disabled}
              aria-busy={isThisLoading}
            >
              <span className="inline-flex items-center gap-2">
                {isThisLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : null}
                <span>{d}</span>
              </span>
            </DropdownMenuCheckboxItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <header
      className="w-full border-b bg-background sticky top-0 z-30"
      style={{ borderBottomWidth: 3 }}
      aria-busy={isLocked}
    >
      {/* Thin global loader bar (visible whenever any dept is loading) */}
      <div
        className={`h-0.5 ${
          isLocked ? "bg-primary animate-pulse" : "bg-transparent"
        }`}
        role="progressbar"
        aria-hidden={!isLocked}
      />
      <span className="sr-only" aria-live="polite">
        {isLocked ? "Loading department orders…" : "Idle"}
      </span>

      {/* Top Row (OUTER container: no px padding here) */}
      <div className="flex h-[60px] md:h-[65px] items-center justify-between gap-2 md:gap-3">
        {/* Brand + Time */}
        <div className="flex items-center gap-3 md:gap-4 min-w-0">
          <h1 className="tracking-widest font-extrabold text-lg md:text-xl lg:text-2xl truncate">
            Baresto Pro
          </h1>
          <div
            className="text-muted-foreground text-[12px] md:text-sm min-w-[80px] md:min-w-[90px] whitespace-nowrap"
            aria-label="Current time"
          >
            {currentTime}
          </div>
        </div>

        {/* Desktop Tabs */}
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
                aria-current={isActive ? "page" : undefined}
                aria-pressed={isActive}
              >
                <span className="whitespace-nowrap">{tab.label}</span>
                <span className="ml-2 inline-flex align-middle">
                  <Badge variant="secondary" className="font-bold">
                    {Number.isFinite(counts?.[tab.key]) ? counts[tab.key] : 0}
                  </Badge>
                </span>
              </button>
            );
          })}
        </nav>

        {/* Actions */}
        <div className="flex items-center gap-2 md:gap-3">
          {/* Search (desktop) */}
          <div className="relative hidden md:block">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={t("search_placeholder")}
              className="pl-9 w-[160px] md:w-[220px] lg:w-[280px]"
              inputMode="search"
              aria-label="Search"
            />
          </div>

          {/* Departments (desktop) */}
          <div className="hidden lg:block">
            {sortedDepartments.length <= 5 ? DeptPills : DeptDropdown}
          </div>

          {/* Settings */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSettingsDialog(true)}
            aria-label="Open settings"
          >
            <Moon className="w-5 h-5" />
          </Button>

          {/* Power / Logout */}
          <Button variant="ghost" size="icon" aria-label="Power">
            <Power className="w-5 h-5" />
          </Button>

          {/* Mobile Tray Toggle */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={onToggleMobileTray}
            aria-expanded={isMobileTrayOpen}
            aria-controls="mobile-tray"
            aria-label={isMobileTrayOpen ? "Close menu" : "Open menu"}
          >
            {isMobileTrayOpen ? (
              <X className="w-5 h-5" />
            ) : (
              <Menu className="w-5 h-5" />
            )}
          </Button>
        </div>
      </div>

      {/* Mobile Tabs (OUTER container: no px padding here) */}
      <nav className="md:hidden border-t pb-1">
        <div className="flex gap-1 overflow-x-auto snap-x snap-mandatory scrollbar-thin scrollbar-thumb-muted-foreground/30 scrollbar-track-transparent">
          {headerTabs.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`relative font-semibold text-sm px-3 h-12 -mb-[3px] border-b-4 transition-colors snap-start shrink-0 ${
                  isActive
                    ? "border-blue-600 text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground/80"
                }`}
                aria-current={isActive ? "page" : undefined}
                aria-pressed={isActive}
              >
                <span className="whitespace-nowrap">{tab.label}</span>
                <span className="ml-2 inline-flex align-middle">
                  <Badge variant="secondary" className="font-bold">
                    {Number.isFinite(counts?.[tab.key]) ? counts[tab.key] : 0}
                  </Badge>
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Mobile Slide-Down Tray (OUTER container: no px padding here) */}
      <div
        id="mobile-tray"
        className={`md:hidden grid grid-cols-1 gap-3 pb-3 border-t overflow-hidden transition-[max-height,opacity] duration-300 ${
          isMobileTrayOpen ? "max-h-[520px] opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        {/* Search */}
        <div className="relative">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={t("search_placeholder")}
            className="pl-9 w-full"
            inputMode="search"
            aria-label="Search orders"
            onKeyDown={(e) => {
              if (e.key === "Enter") closeMobileTray();
            }}
          />
        </div>

        {/* Departments (mobile) */}
        <div className="lg:hidden">
          {sortedDepartments.length <= 5 ? (
            <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-muted-foreground/30 scrollbar-track-transparent">
              {DeptPills}
            </div>
          ) : (
            <div className="flex justify-start">{DeptDropdown}</div>
          )}
        </div>

        {/* Quick actions row */}
        <div className="flex gap-2">
          <Button
            variant="secondary"
            className="flex-1"
            onClick={() => {
              setSettingsDialog(true);
              closeMobileTray();
            }}
          >
            <Settings className="w-4 h-4 mr-2" />
            {t("settings") || "Settings"}
          </Button>
          <Button
            variant="outline"
            className="flex-1"
            onClick={closeMobileTray}
          >
            Done
          </Button>
        </div>
      </div>
    </header>
  );
}
