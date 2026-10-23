"use client";

import { Eye, EyeOff } from "lucide-react";
import { forwardRef, useState, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { Input } from "./input";

/** Password field with a show/hide button. The button keeps one label and reports its state with aria-pressed. */
export const PasswordInput = forwardRef<HTMLInputElement, Omit<InputHTMLAttributes<HTMLInputElement>, "type">>(
  function PasswordInput({ className, ...props }, ref) {
    const [shown, setShown] = useState(false);
    return (
      <span className="relative block">
        <Input ref={ref} type={shown ? "text" : "password"} className={cn("pr-10 max-lg:pr-12", className)} {...props} />
        <button
          type="button"
          onClick={() => setShown((s) => !s)}
          aria-label="Show password"
          aria-pressed={shown}
          className="absolute inset-y-0 right-0 inline-flex w-9 items-center justify-center rounded-r-md text-ink-4 hover:text-ink max-lg:w-11"
        >
          {shown ? <EyeOff aria-hidden className="size-4" /> : <Eye aria-hidden className="size-4" />}
        </button>
      </span>
    );
  },
);
