"use client";

import { useEffect, useId, useRef, useState } from "react";
import styles from "./CityCombobox.module.css";

const NO_CITY_LABEL = "ללא ציון עיר";

type CityComboboxProps = {
  id: string;
  cities: readonly string[];
  value: string;
  onChange: (value: string) => void;
};

/**
 * Hand-built searchable combobox — no dependency, since this is the only
 * field on the site that needs type-to-filter. Follows the ARIA 1.2
 * combobox pattern (role="combobox" on the input, role="listbox" on the
 * options list) so it's queryable the same way a native <select> would be
 * in tests (getByRole("combobox")/getByRole("option")).
 *
 * The input's displayed text is derived, not mirrored: while open it shows
 * the in-progress search query; while closed it shows the confirmed
 * `value`. Opening always starts the query blank (full list), so reopening
 * an already-filled field never re-filters down to just the current
 * selection — the whole list is there to browse/search again immediately.
 */
export function CityCombobox({ id, cities, value, onChange }: CityComboboxProps) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();

  const displayValue = isOpen ? query : value;
  const trimmedQuery = query.trim();
  const filteredCities = trimmedQuery ? cities.filter((city) => city.includes(trimmedQuery)) : cities;
  // "No city" is always offered first, regardless of the search text, so
  // clearing a selection is always one click/Enter away.
  const options = [NO_CITY_LABEL, ...filteredCities];

  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  function openMenu() {
    setQuery("");
    setIsOpen(true);
    setHighlightedIndex(0);
  }

  function selectOption(option: string) {
    onChange(option === NO_CITY_LABEL ? "" : option);
    setIsOpen(false);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!isOpen) {
        openMenu();
        return;
      }
      setHighlightedIndex((i) => Math.min(i + 1, options.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlightedIndex((i) => Math.max(i - 1, 0));
    } else if (event.key === "Enter") {
      if (isOpen) {
        event.preventDefault();
        const target = options[highlightedIndex];
        if (target) selectOption(target);
      }
    } else if (event.key === "Escape") {
      if (isOpen) {
        event.preventDefault();
        setIsOpen(false);
      }
    }
  }

  return (
    <div className={styles.wrap} ref={containerRef}>
      <input
        id={id}
        className={styles.input}
        type="text"
        role="combobox"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-activedescendant={isOpen && options[highlightedIndex] ? `${listboxId}-${highlightedIndex}` : undefined}
        autoComplete="off"
        placeholder="חיפוש עיר..."
        value={displayValue}
        onFocus={openMenu}
        onClick={openMenu}
        onChange={(event) => {
          if (!isOpen) setIsOpen(true);
          setQuery(event.target.value);
          setHighlightedIndex(0);
        }}
        onKeyDown={handleKeyDown}
      />
      {isOpen && (
        <ul className={styles.listbox} role="listbox" id={listboxId}>
          <li
            id={`${listboxId}-0`}
            role="option"
            aria-selected={value === ""}
            className={`${styles.option} ${highlightedIndex === 0 ? styles.highlighted : ""}`}
            onMouseDown={(event) => {
              event.preventDefault();
              selectOption(NO_CITY_LABEL);
            }}
            onMouseEnter={() => setHighlightedIndex(0)}
          >
            {NO_CITY_LABEL}
          </li>
          {filteredCities.length === 0 && trimmedQuery && (
            <li className={styles.empty}>לא נמצאו ערים תואמות</li>
          )}
          {filteredCities.map((city, filteredIndex) => {
            const index = filteredIndex + 1;
            return (
              <li
                key={city}
                id={`${listboxId}-${index}`}
                role="option"
                aria-selected={value === city}
                className={`${styles.option} ${highlightedIndex === index ? styles.highlighted : ""}`}
                onMouseDown={(event) => {
                  event.preventDefault();
                  selectOption(city);
                }}
                onMouseEnter={() => setHighlightedIndex(index)}
              >
                {city}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
