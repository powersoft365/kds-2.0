"use client";

import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Eye,
  EyeOff,
  Lock,
  ChevronDown,
  Search,
  Loader2,
  Building2,
  Database,
} from "lucide-react";
import { useRouter } from "next/navigation";

/* ---------- Shimmer Loader ---------- */
function ShimmerLoader({ label }) {
  return (
    <div className="mt-2 border border-border rounded-lg p-3 bg-muted dark:bg-muted/20 animate-pulse">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-muted-foreground">
          Loading {label}...
        </span>
        <Loader2 className="h-4 w-4 text-purple-500 animate-spin" />
      </div>
      <div className="h-3 w-2/3 bg-muted-foreground/20 rounded mb-2"></div>
      <div className="h-3 w-1/3 bg-muted-foreground/20 rounded"></div>
    </div>
  );
}

/* ---------- Spinner ---------- */
function Spinner() {
  return (
    <div className="flex justify-center items-center py-4">
      <Loader2 className="h-5 w-5 animate-spin text-purple-600 dark:text-purple-400" />
    </div>
  );
}

/* ---------- Animated KDS Logo ---------- */
function AnimatedKDSLogo() {
  return (
    <div className="mx-auto mb-3 flex items-center justify-center">
      <svg
        className="h-12 w-12 text-purple-600 dark:text-purple-400 drop-shadow-sm"
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
      </svg>
      <style jsx>{`
        @keyframes dash {
          to {
            stroke-dashoffset: 0;
          }
        }
      `}</style>
    </div>
  );
}

/* ---------- Dropdown ---------- */
function Dropdown({ label, options, onSelect, isLoading, showCode = false }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [filtered, setFiltered] = useState(options);
  const [selected, setSelected] = useState("");
  const ref = useRef(null);

  useEffect(() => {
    if (search.trim() === "") setFiltered(options);
    else {
      const q = search.toLowerCase();
      setFiltered(
        options.filter((o) => `${o.name} ${o.code}`.toLowerCase().includes(q))
      );
    }
  }, [search, options]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectItem = (item) => {
    setSelected(`${item.name} (${item.code})`);
    setOpen(false);
    onSelect(item);
  };

  return (
    <div className="relative text-left" ref={ref}>
      <Label>{label}</Label>
      <div
        onClick={() => !isLoading && setOpen(!open)}
        className={`mt-2 flex items-center justify-between border rounded-lg px-4 py-3 cursor-pointer transition-all duration-200 ${
          open
            ? "border-purple-600 shadow-sm"
            : "border-border hover:border-purple-400"
        } bg-muted dark:bg-muted/20`}
      >
        <span
          className={`text-sm ${
            selected ? "text-foreground" : "text-muted-foreground italic"
          }`}
        >
          {isLoading
            ? `Loading ${label.toLowerCase()}...`
            : selected || `Select ${label.toLowerCase()}`}
        </span>
        {!isLoading && (
          <ChevronDown
            className={`h-4 w-4 transition-transform ${
              open ? "rotate-180" : ""
            }`}
          />
        )}
      </div>

      {open && !isLoading && (
        <div className="absolute z-10 mt-2 w-full rounded-lg border border-border bg-background shadow-xl animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center px-3 py-2 border-b border-border">
            <Search className="h-4 w-4 mr-2 text-muted-foreground" />
            <input
              type="text"
              placeholder={`Filter ${label.toLowerCase()}...`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
              className="w-full bg-transparent outline-none text-sm text-foreground placeholder:text-muted-foreground"
            />
          </div>

          <ul className="max-h-48 overflow-y-auto">
            {filtered.length > 0 ? (
              filtered.map((item, i) => (
                <li
                  key={i}
                  onClick={() => selectItem(item)}
                  className="flex justify-between items-center px-4 py-2 text-sm cursor-pointer hover:bg-purple-100 dark:hover:bg-purple-900/30 transition"
                >
                  <span className="font-medium">{item.name}</span>
                  {showCode && (
                    <span className="text-muted-foreground text-xs">
                      {item.code}
                    </span>
                  )}
                </li>
              ))
            ) : (
              <li className="px-4 py-2 text-sm text-muted-foreground italic">
                No matches found
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

/* ---------- StepTwo (Company + Database) ---------- */
function StepTwo({ onNext }) {
  const router = useRouter(); // ✅ Added useRouter
  const [companies, setCompanies] = useState([]);
  const [databases, setDatabases] = useState([]);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [selectedDatabase, setSelectedDatabase] = useState(null);
  const [loadingCompanies, setLoadingCompanies] = useState(true);
  const [loadingDatabases, setLoadingDatabases] = useState(false);

  useEffect(() => {
    async function loadCompanies() {
      setLoadingCompanies(true);
      try {
        const cred = JSON.parse(localStorage.getItem("cred") || "{}");
        const res = await fetch("/api/authentication/companies", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ encryptedUsername: cred.username }),
        });
        const json = await res.json();
        if (json.ok) {
          const list = json.data.list_user_active_companies.map((c) => ({
            name: c.company_name,
            code: c.company_code_365,
          }));
          setCompanies(list);

          if (list.length === 1) {
            setSelectedCompany(list[0]);
            handleCompanySelect(list[0]);
          }
        } else toast.error("Failed to load companies.");
      } catch {
        toast.error("Network error while loading companies.");
      } finally {
        setLoadingCompanies(false);
      }
    }
    loadCompanies();
  }, []);

  async function handleCompanySelect(company) {
    setSelectedCompany(company);
    setDatabases([]);
    setSelectedDatabase(null);
    setLoadingDatabases(true);
    try {
      const cred = JSON.parse(localStorage.getItem("cred") || "{}");
      const res = await fetch("/api/authentication/databases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyCode: company.code,
          encryptedUsername: cred.username,
        }),
      });
      const json = await res.json();
      if (json.ok) {
        const list = json.data.list_company_databases.map((d) => ({
          name: d.database_name,
          code: d.database_code_365,
        }));
        setDatabases(list);
        if (list.length === 1) setSelectedDatabase(list[0]);
      } else toast.error("Failed to load databases.");
    } catch {
      toast.error("Error fetching databases.");
    } finally {
      setLoadingDatabases(false);
    }
  }

  const handleNext = async () => {
    if (!selectedCompany)
      return toast.warning("Please select a company first.");
    if (!selectedDatabase) return toast.warning("Please select a database.");

    const cred = JSON.parse(localStorage.getItem("cred") || "{}");

    try {
      toast.loading("Generating access token...", { id: "genToken" });

      const res = await fetch("/api/authentication/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: cred.username,
          password: cred.password,
          databaseCode: selectedDatabase.code,
        }),
      });

      const data = await res.json();

      toast.dismiss("genToken");

      if (data.ok && data.token) {
        localStorage.setItem("ps365_token", data.token);
        toast.success("Access token created successfully.");
        // ✅ Redirect to home page instead of just calling onNext()
        router.push("/");
        return;
      }

      const msg = String(data.message || "").toLowerCase();
      if (msg.includes("not linked")) {
        toast.error(
          "This database isn’t linked to your application. Check your PowerSoft365 setup."
        );
      } else if (msg.includes("invalid data")) {
        toast.error(
          "Invalid credentials or configuration. Please verify and retry."
        );
      } else if (msg.includes("token") && msg.includes("failed")) {
        toast.error("Couldn’t create token. Try again in a few seconds.");
      } else if (msg.includes("relocation")) {
        toast.info("Re-linking your previous device session. Please wait...");
      } else {
        toast.error("Something went wrong while generating your access token.");
      }
    } catch (err) {
      toast.dismiss("genToken");
      toast.error("Network connection failed. Please try again.");
    }
  };

  return (
    <div className="space-y-6 text-center">
      <h2 className="text-xl font-semibold text-foreground">
        Company & Database
      </h2>

      {/* Company Section */}
      {loadingCompanies ? (
        <ShimmerLoader label="companies" />
      ) : companies.length === 1 && selectedCompany ? (
        <div className="border rounded-lg p-3 bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/30 dark:to-indigo-900/30 text-left shadow-sm transition-all">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-purple-500" />
            <p className="font-medium text-foreground">
              {selectedCompany.name}
            </p>
          </div>
          <p className="text-muted-foreground text-xs mt-1">
            Code: {selectedCompany.code}
          </p>
        </div>
      ) : (
        <Dropdown
          label="Company"
          options={companies}
          onSelect={(val) => handleCompanySelect(val)}
          showCode={true}
          isLoading={loadingCompanies}
        />
      )}

      {loadingDatabases && <Spinner />}

      {/* Database Section */}
      {!loadingDatabases &&
        (databases.length === 1 && selectedDatabase ? (
          <div className="border rounded-lg p-3 bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/30 dark:to-indigo-900/30 text-left shadow-sm">
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-purple-500" />
              <p className="font-medium text-foreground">
                {selectedDatabase.name}
              </p>
            </div>
            <p className="text-muted-foreground text-xs mt-1">
              Code: {selectedDatabase.code}
            </p>
          </div>
        ) : (
          databases.length > 1 && (
            <Dropdown
              label="Database"
              options={databases}
              onSelect={(val) => setSelectedDatabase(val)}
              showCode={true}
              isLoading={loadingDatabases}
            />
          )
        ))}

      {/* Next Button only when DB selected */}
      {selectedDatabase && (
        <button
          onClick={handleNext}
          className="w-full mt-4 rounded-full py-3 font-medium bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:from-purple-700 hover:to-indigo-700 dark:from-purple-500 dark:to-indigo-500 dark:hover:from-purple-600 dark:hover:to-indigo-600 shadow-lg transition-all active:scale-[0.98]"
        >
          Next
        </button>
      )}
    </div>
  );
}

/* ---------- Main Login Page ---------- */
export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [step, setStep] = useState(1);
  const isValid = username.trim() && password.trim();

  useEffect(() => {
    const storedCred = localStorage.getItem("cred");
    if (storedCred) {
      const parsed = JSON.parse(storedCred);
      if (parsed && Object.keys(parsed).length > 0) setStep(2);
    }
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!isValid) return toast.warning("Please enter both fields.");
    setIsLoading(true);
    try {
      const res = await fetch("/api/authentication/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const result = await res.json();
      if (result.ok) {
        localStorage.setItem("cred", JSON.stringify(result.credentials));
        toast.success("Login successful!");
        setStep(2);
      } else toast.error(result.message || "Login failed.");
    } catch {
      toast.error("Network error.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen bg-background text-foreground overflow-hidden">
      {/* Gradient Glow Background */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full blur-3xl opacity-25 bg-purple-400 dark:bg-purple-800" />
        <div className="absolute -bottom-24 -right-24 h-80 w-80 rounded-full blur-3xl opacity-25 bg-indigo-400 dark:bg-indigo-800" />
      </div>

      {/* Card Center */}
      <div className="relative z-10 flex items-center justify-center min-h-screen">
        <div className="w-full max-sm:px-2 max-w-md">
          <Card className="border border-border shadow-2xl backdrop-blur supports-[backdrop-filter]:bg-background/80">
            <CardHeader className="text-center space-y-2">
              <AnimatedKDSLogo />
              <h1 className="text-2xl font-bold tracking-tight">
                {step === 1 ? "KDS Login" : "Select Setup"}
              </h1>
              <p className="text-sm text-muted-foreground">
                {step === 1
                  ? "Kitchen Display System"
                  : "Setup your company and database access"}
              </p>
            </CardHeader>

            <CardContent>
              {step === 1 ? (
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="username">Username</Label>
                    <Input
                      id="username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Enter username"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="pl-9"
                        placeholder="Enter password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
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
                    className="w-full rounded-full py-3 font-medium bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:from-purple-700 hover:to-indigo-700 dark:from-purple-500 dark:to-indigo-500 dark:hover:from-purple-600 dark:hover:to-indigo-600 shadow-lg transition disabled:opacity-50 active:scale-[0.98]"
                  >
                    {isLoading ? (
                      <span className="flex justify-center items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Logging in...
                      </span>
                    ) : (
                      "Login"
                    )}
                  </button>
                </form>
              ) : (
                <StepTwo onNext={() => toast.success("Setup complete!")} />
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
