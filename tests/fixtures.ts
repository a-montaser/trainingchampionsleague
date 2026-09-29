import type {
  EntryRow,
  HeadcountRow,
  MemberRow,
  RoundRow,
  RoundStartDivisionRow,
  TeamRow,
} from '@/lib/scoring/types';

/** The ten real teams, in the order the tournament settings list them. */
export const TEAM_NAMES = [
  'UK MVA/Web',
  'Ireland',
  'OneApp',
  'Mpesa',
  'DE portals',
  'CIT',
  'MVA Germany',
  'Web factory',
  'DE enterprise',
  'Vodacom',
] as const;

export const STARTING_DIVISION_1 = [
  'CIT',
  'MVA Germany',
  'Web factory',
  'DE enterprise',
  'Vodacom',
] as const;

export const teams: TeamRow[] = TEAM_NAMES.map((name) => ({ id: slug(name), name }));

export function slug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export const round1: RoundRow = {
  id: 'r1',
  index: 1,
  name: 'Round 1',
  startsOn: '2026-10-01',
  endsOn: '2026-12-31',
  status: 'open',
};

export const round2: RoundRow = {
  id: 'r2',
  index: 2,
  name: 'Round 2',
  startsOn: '2027-01-01',
  endsOn: '2027-03-31',
  status: 'scheduled',
};

const STARTING_DIVISION_2 = TEAM_NAMES.filter(
  (name) => !STARTING_DIVISION_1.includes(name as (typeof STARTING_DIVISION_1)[number]),
);

/** Division 1 teams take ranks 1-5, Division 2 teams ranks 6-10. */
export const round1StartDivisions: RoundStartDivisionRow[] = [
  ...STARTING_DIVISION_1.map((name, i) => ({
    teamId: slug(name),
    division: 1 as const,
    rank: i + 1,
  })),
  ...STARTING_DIVISION_2.map((name, i) => ({
    teamId: slug(name),
    division: 2 as const,
    rank: 6 + i,
  })),
];

/** Every team starts on a headcount of 10 from day one. */
export const headcounts: HeadcountRow[] = teams.map((team) => ({
  teamId: team.id,
  headcount: 10,
  effectiveFrom: '2026-10-01',
}));

/** Ten active members per team, named `<team>-u1` … `<team>-u10`. */
export const members: MemberRow[] = teams.flatMap((team) =>
  Array.from({ length: 10 }, (_, i) => ({
    userId: `${team.id}-u${i + 1}`,
    teamId: team.id,
    isActive: true,
  })),
);

let entrySeq = 0;

export function entry(partial: Partial<EntryRow> & Pick<EntryRow, 'teamId' | 'durationMinutes'>): EntryRow {
  entrySeq += 1;
  return {
    id: `e${entrySeq}`,
    userId: partial.userId ?? `${partial.teamId}-u1`,
    roundId: partial.roundId ?? round1.id,
    completedOn: partial.completedOn ?? '2026-10-05',
    status: partial.status ?? 'counted',
    ...partial,
  };
}

export function teamId(name: (typeof TEAM_NAMES)[number]): string {
  return slug(name);
}
