"use client";

import * as Flags from "country-flag-icons/react/3x2";
import { Check, ChevronDown, Languages } from "lucide-react";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";

import { cn } from "@/core/utils/cn";

import { COUNTRY_LIST } from "./countryList";
import type {
  CountryOption,
  DeepLTargetLanguage,
  SelectorCountryProps,
} from "./types";

function CountryFlag({ option }: { option: CountryOption }) {
  const FlagComponent = Flags[option.flag];

  if (!FlagComponent) {
    return null;
  }

  return (
    <FlagComponent
      aria-label={`Bandeira ${option.flag}`}
      className="h-4 w-6 shrink-0 rounded-sm object-cover"
    />
  );
}

export function SelectorCountry({
  value,
  defaultValue,
  placeholder = "Selecionar idioma",
  disabled = false,
  className,
  onSelect,
}: SelectorCountryProps) {
  const [internalValue, setInternalValue] = useState<
    DeepLTargetLanguage | undefined
  >(defaultValue);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const listboxId = useId();
  const selectedValue = value ?? internalValue;
  const dropdownIsOpen = isOpen && !disabled;
  const selectedOption = COUNTRY_LIST.find(
    (option) => option.label === selectedValue,
  );
  const selectedIndex = COUNTRY_LIST.findIndex(
    (option) => option.label === selectedValue,
  );

  useEffect(() => {
    if (!dropdownIsOpen) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [dropdownIsOpen]);

  function openDropdown() {
    if (disabled) {
      return;
    }

    setIsOpen(true);
    requestAnimationFrame(() => {
      optionRefs.current[selectedIndex >= 0 ? selectedIndex : 0]?.focus();
    });
  }

  function closeDropdown(restoreFocus = false) {
    setIsOpen(false);
    if (restoreFocus) {
      requestAnimationFrame(() => triggerRef.current?.focus());
    }
  }

  function handleSelect(language: DeepLTargetLanguage) {
    if (value === undefined) {
      setInternalValue(language);
    }

    onSelect(language);
    closeDropdown(true);
  }

  function handleTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) {
      event.preventDefault();
      openDropdown();
    }
  }

  function handleOptionKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) {
    let nextIndex: number | undefined;

    if (event.key === "ArrowDown") {
      nextIndex = (index + 1) % COUNTRY_LIST.length;
    } else if (event.key === "ArrowUp") {
      nextIndex = (index - 1 + COUNTRY_LIST.length) % COUNTRY_LIST.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = COUNTRY_LIST.length - 1;
    } else if (event.key === "Escape") {
      event.preventDefault();
      closeDropdown(true);
      return;
    } else if (event.key === "Tab") {
      closeDropdown();
      return;
    }

    if (nextIndex !== undefined) {
      event.preventDefault();
      optionRefs.current[nextIndex]?.focus();
    }
  }

  return (
    <div className="relative w-full" ref={containerRef}>
      <button
        aria-controls={dropdownIsOpen ? listboxId : undefined}
        aria-expanded={dropdownIsOpen}
        aria-haspopup="listbox"
        aria-label="Selecionar idioma"
        className={cn(
          "flex h-10 w-full items-center gap-2 rounded-lg bg-gray-100 px-3 text-sm",
          "focus-visible:ring-primary-green focus-visible:ring-2 focus-visible:outline-none",
          "dark:focus-visible:ring-light-green disabled:cursor-not-allowed disabled:opacity-50 dark:bg-gray-900",
          className,
        )}
        disabled={disabled}
        onClick={() => (dropdownIsOpen ? closeDropdown() : openDropdown())}
        onKeyDown={handleTriggerKeyDown}
        ref={triggerRef}
        type="button"
      >
        <Languages
          aria-hidden="true"
          className="text-primary-green dark:text-light-green size-4 shrink-0"
        />

        {selectedOption && <CountryFlag option={selectedOption} />}

        <span className="min-w-0 flex-1 truncate text-left">
          {selectedOption?.label ?? placeholder}
        </span>

        <ChevronDown
          aria-hidden="true"
          className={cn(
            "size-4 shrink-0 transition-transform",
            dropdownIsOpen && "rotate-180",
          )}
        />
      </button>

      {dropdownIsOpen && (
        <div
          aria-label="Idiomas disponíveis"
          className="absolute top-full right-0 left-0 z-50 mt-1 max-h-72 overflow-y-auto rounded-lg bg-white p-1 shadow-lg ring-1 ring-black/10 dark:bg-gray-900 dark:ring-white/10"
          id={listboxId}
          role="listbox"
        >
          {COUNTRY_LIST.map((option, index) => {
            const isSelected = option.label === selectedValue;

            return (
              <button
                aria-selected={isSelected}
                className={cn(
                  "flex w-full cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm",
                  "hover:bg-gray-200 focus-visible:bg-gray-200 focus-visible:outline-none dark:hover:bg-gray-800 dark:focus-visible:bg-gray-800",
                  isSelected && "bg-gray-200 dark:bg-gray-800",
                )}
                key={option.label}
                onClick={() => handleSelect(option.label)}
                onKeyDown={(event) => handleOptionKeyDown(event, index)}
                ref={(element) => {
                  optionRefs.current[index] = element;
                }}
                role="option"
                tabIndex={
                  index === (selectedIndex >= 0 ? selectedIndex : 0) ? 0 : -1
                }
                type="button"
              >
                <CountryFlag option={option} />
                <span className="flex-1 text-left">{option.label}</span>
                {isSelected && (
                  <Check aria-hidden="true" className="size-4 shrink-0" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export type { DeepLTargetLanguage, SelectorCountryProps } from "./types";
