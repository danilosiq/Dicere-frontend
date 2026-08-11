"use client";

import { Eye, EyeOff } from "lucide-react";
import {
  forwardRef,
  useId,
  useState,
  type ChangeEvent,
  type InputHTMLAttributes,
} from "react";

import { Input } from "@/components/ui/input";
import { Column } from "@/core/components/layout";
import { Typography } from "@/core/components/typography";
import { cn } from "@/core/utils/cn";

type LabelPosition = "left" | "center" | "right";

export type InputTextProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  labelPosition?: LabelPosition;
  error?: string;
  mask?: string | ((value: string) => string);
  containerClassName?: string;
  labelClassName?: string;
};

const labelPositionClasses: Record<LabelPosition, string> = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
};

function applyStringMask(value: string, mask: string) {
  const cleanValue = value.replace(/[^a-zA-Z0-9]/g, "");
  let valueIndex = 0;

  return mask.split("").reduce((maskedValue, maskChar) => {
    if (valueIndex >= cleanValue.length) {
      return maskedValue;
    }

    const currentValue = cleanValue[valueIndex];

    if (maskChar === "9") {
      if (!/\d/.test(currentValue)) {
        valueIndex += 1;
        return maskedValue;
      }

      valueIndex += 1;
      return `${maskedValue}${currentValue}`;
    }

    if (maskChar === "A") {
      if (!/[a-zA-Z]/.test(currentValue)) {
        valueIndex += 1;
        return maskedValue;
      }

      valueIndex += 1;
      return `${maskedValue}${currentValue}`;
    }

    if (maskChar === "*") {
      valueIndex += 1;
      return `${maskedValue}${currentValue}`;
    }

    return `${maskedValue}${maskChar}`;
  }, "");
}

function applyMask(value: string, mask: InputTextProps["mask"]) {
  if (!mask) {
    return value;
  }

  if (typeof mask === "function") {
    return mask(value);
  }

  return applyStringMask(value, mask);
}

const InputText = forwardRef<HTMLInputElement, InputTextProps>(
  (
    {
      id,
      label,
      labelPosition = "left",
      error,
      mask,
      required,
      type,
      className,
      containerClassName,
      labelClassName,
      onChange,
      "aria-describedby": ariaDescribedBy,
      ...props
    },
    ref,
  ) => {
    const [isPasswordVisible, setIsPasswordVisible] = useState(false);
    const generatedId = useId();
    const inputId = id ?? generatedId;
    const errorId = error ? `${inputId}-error` : undefined;
    const describedBy =
      [ariaDescribedBy, errorId].filter(Boolean).join(" ") || undefined;
    const isPasswordInput = type === "password";
    const inputType =
      isPasswordInput && isPasswordVisible ? "text" : (type ?? "text");

    function handleChange(event: ChangeEvent<HTMLInputElement>) {
      if (mask) {
        const maskedValue = applyMask(event.target.value, mask);

        event.target.value = maskedValue;
        event.currentTarget.value = maskedValue;
      }

      onChange?.(event);
    }

    return (
      <Column className={cn("w-full", containerClassName)}>
        {label && (
          <label htmlFor={inputId} className="w-full">
            <Typography
              className={cn(
                "text-foreground block dark:text-gray-100",
                labelPositionClasses[labelPosition],
                labelClassName,
              )}
              fontFamily="baloo2"
              fontWeight="semibold"
            >
              {label}
              {required && <span className="text-error"> *</span>}
            </Typography>
          </label>
        )}

        <div className="relative w-full">
          <Input
            aria-describedby={describedBy}
            aria-invalid={error ? true : undefined}
            className={cn(
              "border-border text-foreground h-11 w-full rounded-lg placeholder:text-gray-400",
              "focus-visible:ring-primary-green",
              "disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400 disabled:opacity-100",
              "dark:bg-gray-900 dark:text-gray-100 dark:placeholder:text-gray-400 dark:disabled:bg-gray-800 dark:disabled:text-gray-400",
              error && "border-error focus-visible:ring-error",
              className,
              isPasswordInput && "pr-11",
            )}
            id={inputId}
            onChange={handleChange}
            ref={ref}
            required={required}
            type={inputType}
            {...props}
          />

          {isPasswordInput && (
            <button
              aria-label={isPasswordVisible ? "Ocultar senha" : "Mostrar senha"}
              aria-pressed={isPasswordVisible}
              className={cn(
                "hover:text-foreground focus-visible:ring-primary-green absolute top-1/2 right-3 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-gray-400 outline-none focus-visible:ring-2",
                "disabled:cursor-not-allowed disabled:text-gray-400 disabled:opacity-60 dark:hover:text-gray-100",
              )}
              disabled={props.disabled}
              onClick={() => setIsPasswordVisible((current) => !current)}
              type="button"
            >
              {isPasswordVisible ? (
                <EyeOff aria-hidden="true" className="size-5" />
              ) : (
                <Eye aria-hidden="true" className="size-5" />
              )}
            </button>
          )}
        </div>

        {error && (
          <Typography
            className="text-error block"
            color="error"
            darkColor="white"
            size="sm"
          >
            <span id={errorId}>{error}</span>
          </Typography>
        )}
      </Column>
    );
  },
);

InputText.displayName = "InputText";

export { InputText };
