"use client";

import { useQueryClient } from "@tanstack/react-query";
import { RotateCcw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { resetDemoState, useDemoState } from "@/lib/demo-state";
import { MAX_USER_TRANSFERS } from "@/lib/schemas";

/** Clears the client-held event log: transfers and card state go back to the seed. */
export function ResetDemoButton() {
  const queryClient = useQueryClient();
  const state = useDemoState();
  const [open, setOpen] = useState(false);
  const changes = state.transfers.length + Object.keys(state.cardStatus).length;

  function reset() {
    resetDemoState();
    // Every query derives from the event log, so drop them all.
    void queryClient.resetQueries();
    setOpen(false);
    toast.success("Demo data reset");
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <DialogTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Reset demo data">
              <RotateCcw className="size-4" aria-hidden="true" />
            </Button>
          </DialogTrigger>
        </TooltipTrigger>
        <TooltipContent>Reset demo data</TooltipContent>
      </Tooltip>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reset demo data?</DialogTitle>
          <DialogDescription>
            This removes the transfers you&apos;ve made and restores card settings. Seeded accounts and transactions
            stay the same.
          </DialogDescription>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          {changes === 0
            ? "You haven't made any changes yet."
            : `${state.transfers.length} of ${MAX_USER_TRANSFERS} demo transfers used.`}
        </p>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button variant="destructive" onClick={reset} disabled={changes === 0}>
            Reset demo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
