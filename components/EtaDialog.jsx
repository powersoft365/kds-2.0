// app/kds-pro/components/EtaDialog.jsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function EtaDialog({
  open,
  onOpenChange,
  orderId,
  orders,
  setOrders,
  // FIX: accept `toast` from sonner (passed in KdsPro)
  toast,
}) {
  const etaOrder = useMemo(
    () => orders.find((o) => o.id === orderId),
    [orderId, orders]
  );

  const [etaValue, setEtaValue] = useState(0);

  useEffect(() => {
    if (open && etaOrder) setEtaValue(etaOrder.eta);
  }, [open, etaOrder]);

  const saveEta = () => {
    if (!etaOrder) return onOpenChange(false);
    setOrders((list) =>
      list.map((o) =>
        o.id === etaOrder.id
          ? { ...o, eta: Math.max(1, parseInt(etaValue || 1)) }
          : o
      )
    );
    // FIX: use the passed in sonner toast
    if (toast) {
      toast.info(`ETA for order #${etaOrder.id} updated.`, {
        description: `${Math.max(1, parseInt(etaValue || 1))} min`,
        icon: "⏱️",
      });
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Adjust ETA for Order #{etaOrder?.id}</DialogTitle>
        </DialogHeader>
        <div className="text-center space-y-5">
          <div className="flex justify-center gap-3">
            {[-5, -1, +1, +5].map((step) => (
              <Button
                key={step}
                variant="secondary"
                className="w-16 h-16 text-2xl font-extrabold rounded-full"
                onClick={() =>
                  setEtaValue((v) => Math.max(1, parseInt(v || 1) + step))
                }
              >
                {step > 0 ? `+${step}` : step}
              </Button>
            ))}
          </div>
          <div className="text-6xl font-extrabold">{etaValue}</div>
          <div className="flex items-center justify-center gap-3">
            <Input
              type="number"
              value={etaValue}
              onChange={(e) => setEtaValue(e.target.value)}
              className="w-28 text-center text-2xl font-extrabold py-4"
            />
            <span className="text-xl font-medium">min</span>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="px-6 py-3"
            >
              Cancel
            </Button>
            <Button onClick={saveEta} className="font-bold px-6 py-3">
              Save
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
