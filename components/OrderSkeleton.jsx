"use client";

import React from "react";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";

export function OrderSkeleton() {
  return (
    <Card className="h-full border-t-8 border-muted/40 overflow-hidden">
      <CardHeader className="bg-muted/40 py-3">
        <div className="h-4 w-32 rounded bg-muted animate-pulse mb-2" />
        <div className="h-3 w-24 rounded bg-muted animate-pulse" />
      </CardHeader>

      <CardContent className="pt-4 pb-2">
        <div className="space-y-3 max-h-[240px] overflow-hidden">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-6 h-6 rounded-md bg-muted animate-pulse" />
              <div className="h-4 w-10 rounded bg-muted animate-pulse" />
              <div className="flex-1 h-4 rounded bg-muted animate-pulse" />
            </div>
          ))}
        </div>
      </CardContent>

      <CardFooter className="bg-muted/40 p-4">
        <div className="w-full flex flex-col gap-3">
          <div className="h-3 w-24 mx-auto rounded bg-muted animate-pulse" />
          <div className="grid grid-cols-2 gap-3">
            <div className="h-10 rounded bg-muted animate-pulse" />
            <div className="h-10 rounded bg-muted animate-pulse" />
          </div>
        </div>
      </CardFooter>
    </Card>
  );
}
