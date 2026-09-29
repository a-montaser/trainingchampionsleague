'use client';

import { useState, type ReactNode } from 'react';
import { EmptyState, Field, Input } from '@/components/ui';

/**
 * Filters the team cards as the admin types — no Enter, no round trip. Every
 * team is already on the page, so matching happens in the browser.
 *
 * Non-matching cards are hidden rather than unmounted, so a half-typed rename
 * or headcount survives the filter changing.
 */
export function TeamSearch({ teams }: { teams: Array<{ id: string; name: string; card: ReactNode }> }) {
  const [query, setQuery] = useState('');
  const needle = query.trim().toLowerCase();
  const matches = (name: string) => !needle || name.toLowerCase().includes(needle);
  const matchCount = teams.filter((team) => matches(team.name)).length;

  return (
    <>
      <Field label="Search teams" htmlFor="team-search">
        <Input
          id="team-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="e.g. Agent Desktop"
          autoComplete="off"
          className="sm:w-80"
        />
      </Field>

      {needle && (
        <p aria-live="polite" className="-mt-2 text-sm text-muted">
          {matchCount === 1 ? '1 team' : `${matchCount} teams`} matching “{query.trim()}”
        </p>
      )}

      {teams.map((team) => (
        <div key={team.id} hidden={!matches(team.name)}>
          {team.card}
        </div>
      ))}

      {needle && matchCount === 0 && <EmptyState title="No teams match your search." />}
    </>
  );
}
