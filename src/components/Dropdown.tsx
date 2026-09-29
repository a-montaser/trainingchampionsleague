'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { claimOpenDropdown, releaseOpenDropdown } from './dropdown-registry';
import { cx } from './ui';

export interface DropdownOption {
  value: string;
  label: string;
}

/**
 * The site's dropdown, replacing the browser's native `<select>` so it matches
 * the rest of the UI.
 *
 * Opening:
 *  - **Click or tap** the field toggles it, and flips the chevron up. Hover
 *    does nothing, so the list never opens under a passing cursor.
 *  - It stays open until the user clicks elsewhere, picks an option, presses
 *    Escape, or opens another dropdown — only one is ever open at a time.
 *  - **Keyboard** works throughout (arrows, Enter, Escape, Home/End), and the
 *    ARIA roles mean screen readers announce it as a listbox.
 *
 * In a form it writes to a hidden input, so `FormData` sees exactly what a
 * native select would have submitted.
 */
export function Dropdown({
  id,
  name,
  options,
  value,
  defaultValue = '',
  placeholder = 'Select…',
  disabled,
  onChange,
}: {
  id: string;
  /** Omit for a filter that is not part of a submitted form. */
  name?: string;
  options: DropdownOption[];
  /** Pass to control the value; omit to let the component hold it. */
  value?: string;
  defaultValue?: string;
  placeholder?: string;
  disabled?: boolean;
  onChange?: (value: string) => void;
}) {
  const isControlled = value !== undefined;
  const [internalValue, setInternalValue] = useState(defaultValue);
  const current = isControlled ? value : internalValue;

  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const selectedIndex = options.findIndex((option) => option.value === current);
  const selectedLabel = selectedIndex >= 0 ? options[selectedIndex].label : '';

  const close = useCallback(() => {
    setOpen(false);
    setActiveIndex(-1);
    releaseOpenDropdown(id);
  }, [id]);

  const openList = useCallback(() => {
    if (disabled) return;
    // Closes any other open dropdown, so only one is ever on screen.
    claimOpenDropdown(id, close);
    setOpen(true);
    setActiveIndex((previous) => (previous >= 0 ? previous : Math.max(selectedIndex, 0)));
  }, [close, disabled, id, selectedIndex]);

  // Do not leave the registry pointing at an unmounted dropdown.
  useEffect(() => () => releaseOpenDropdown(id), [id]);

  const choose = useCallback(
    (next: string) => {
      if (!isControlled) setInternalValue(next);
      onChange?.(next);
      close();
      triggerRef.current?.focus();
    },
    [close, isControlled, onChange],
  );

  // Clicking elsewhere closes a list that was opened by click rather than hover.
  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: PointerEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) close();
    }

    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open, close]);

  // Keep the keyboard-highlighted option in view in a long list.
  useEffect(() => {
    if (!open || activeIndex < 0) return;
    listRef.current?.children[activeIndex]?.scrollIntoView({ block: 'nearest' });
  }, [open, activeIndex]);

  function onKeyDown(event: React.KeyboardEvent) {
    if (disabled) return;

    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowUp': {
        event.preventDefault();
        if (!open) {
          openList();
          return;
        }
        const step = event.key === 'ArrowDown' ? 1 : -1;
        setActiveIndex((previous) => {
          const next = previous + step;
          if (next < 0) return options.length - 1;
          if (next >= options.length) return 0;
          return next;
        });
        return;
      }
      case 'Home':
        if (open) {
          event.preventDefault();
          setActiveIndex(0);
        }
        return;
      case 'End':
        if (open) {
          event.preventDefault();
          setActiveIndex(options.length - 1);
        }
        return;
      case 'Enter':
      case ' ':
        event.preventDefault();
        if (open && activeIndex >= 0) choose(options[activeIndex].value);
        else openList();
        return;
      case 'Escape':
        if (open) {
          event.preventDefault();
          close();
        }
        return;
      case 'Tab':
        close();
    }
  }

  return (
    // Opens on click or keyboard only — never on hover. It then stays open
    // until the user clicks elsewhere, picks an option, presses Escape, or
    // opens another dropdown.
    <div ref={wrapperRef} className="relative">
      {name && <input type="hidden" name={name} value={current} />}

      <button
        ref={triggerRef}
        id={id}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-listbox`}
        aria-activedescendant={open && activeIndex >= 0 ? `${id}-option-${activeIndex}` : undefined}
        disabled={disabled}
        onClick={() => (open ? close() : openList())}
        onKeyDown={onKeyDown}
        className={cx(
          'flex min-h-11 w-full items-center justify-between gap-2 rounded-[10px] border bg-input px-3.5 text-left text-sm transition-colors',
          disabled ? 'cursor-not-allowed opacity-50' : 'hover:border-brand/40',
          open ? 'border-brand' : 'border-white/12',
          selectedLabel ? 'text-ink' : 'text-muted/70',
        )}
      >
        <span className="truncate">{selectedLabel || placeholder}</span>
        <Chevron pointingUp={open} />
      </button>

      {open && (
        <ul
          ref={listRef}
          id={`${id}-listbox`}
          role="listbox"
          aria-labelledby={id}
          tabIndex={-1}
          className="absolute left-0 right-0 z-[60] mt-1 max-h-64 overflow-y-auto rounded-xl border border-line-strong bg-surface py-1 shadow-xl shadow-black/40"
        >
          {options.map((option, index) => {
            const isSelected = option.value === current;
            const isActive = index === activeIndex;

            return (
              <li
                key={option.value}
                id={`${id}-option-${index}`}
                role="option"
                aria-selected={isSelected}
                onPointerEnter={() => setActiveIndex(index)}
                onClick={() => choose(option.value)}
                className={cx(
                  'flex min-h-11 cursor-pointer items-center justify-between gap-2 px-3 text-sm',
                  isActive && 'bg-white/5',
                  isSelected ? 'font-medium text-brand-text' : 'text-ink',
                )}
              >
                <span className="truncate">{option.label}</span>
                {isSelected && <span aria-hidden="true">✓</span>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** Points down when closed, up when open. Shared with the nav menu. */
export function Chevron({ pointingUp }: { pointingUp: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      aria-hidden="true"
      className={cx(
        'h-4 w-4 shrink-0 text-muted transition-transform duration-200',
        pointingUp && 'rotate-180',
      )}
    >
      <path
        d="M5 7.5 10 12.5 15 7.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
