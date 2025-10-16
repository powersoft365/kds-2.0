// app/kds-pro/components/SettingsDialog.jsx
"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { useTheme } from "next-themes";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function SettingsDialog({
  open,
  onOpenChange,
  language,
  setLanguage,
  i18n,
  t,
}) {
  const { theme, setTheme } = useTheme();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("settings")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-6">
          <div>
            <div className="font-bold mb-3 text-lg">Theme</div>
            <div className="grid grid-cols-2 gap-3">
              <Button
                variant={theme === "dark" ? "default" : "secondary"}
                onClick={() => setTheme("dark")}
                className="font-bold py-6"
              >
                Dark
              </Button>
              <Button
                variant={theme === "light" ? "default" : "secondary"}
                onClick={() => setTheme("light")}
                className="font-bold py-6"
              >
                Light
              </Button>
            </div>
          </div>
          <div>
            <div className="font-bold mb-3 text-lg">Language</div>
            <div className="grid grid-cols-2 gap-3">
              {Object.keys(i18n).map((lng) => (
                <Button
                  key={lng}
                  variant={language === lng ? "default" : "secondary"}
                  onClick={() => setLanguage(lng)}
                  className="font-bold py-6"
                >
                  {lng.toUpperCase()}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
