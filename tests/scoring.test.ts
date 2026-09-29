import { describe, expect, it } from 'vitest';
import {
  buildRoundClosePreview,
  computeIndividualStandings,
  computeTeamStandings,
  formatHours,
  formatScore,
  formatScoreLabel,
  resolveHeadcount,
  scoreGap,
  scorePoints,
} from '@/lib/scoring';
import type { EntryRow, HeadcountRow, RoundRow, TeamStanding } from '@/lib/scoring/types';
import {
  entry,
  headcounts,
  members,
  round1,
  round1StartDivisions,
  teamId,
  teams,
} from './fixtures';

const TODAY = '2026-11-15';

function standings(
  overrides: {
    entries?: EntryRow[];
    headcounts?: HeadcountRow[];
    round?: RoundRow;
    today?: string;
    members?: typeof members;
  } = {},
): TeamStanding[] {
  return computeTeamStandings({
    teams,
    entries: overrides.entries ?? [],
    headcounts: overrides.headcounts ?? headcounts,
    members: overrides.members ?? members,
    round: overrides.round ?? round1,
    roundStartDivisions: round1StartDivisions,
    today: overrides.today ?? TODAY,
    division1Size: 5,
  });
}

function row(list: TeamStanding[], name: Parameters<typeof teamId>[0]): TeamStanding {
  const found = list.find((s) => s.teamId === teamId(name));
  if (!found) throw new Error(`no standing for ${name}`);
  return found;
}

describe('display formatting', () => {
  it('shows individual totals as hours to 1 decimal place', () => {
    expect(formatHours(0)).toBe('0.0');
    expect(formatHours(90)).toBe('1.5');
    expect(formatHours(65)).toBe('1.1');
    expect(formatHours(1_234)).toBe('20.6');
  });

  it('shows team score as hours ÷ headcount × 100, as a whole number', () => {
    expect(formatScore(600, 10)).toBe('100'); // 10 h ÷ 10 people × 100
    expect(formatScore(1_000, 7)).toBe('238'); // 16.67 h ÷ 7 × 100 = 238.1
    expect(formatScore(0, 10)).toBe('0');
  });

  it('labels every on-screen score with points, singular for one', () => {
    expect(formatScoreLabel(1_431, 10)).toBe('239 points');
    expect(formatScoreLabel(3, 10)).toBe('1 point');
    expect(formatScoreLabel(0, 10)).toBe('0 points');
    expect(formatScoreLabel(600, null)).toBe('0 points');
  });

  it('rounds to the nearest whole number, with halves rounding up', () => {
    expect(scorePoints(1_430, 10)).toBe(238); // 238.33
    expect(scorePoints(1_432, 10)).toBe(239); // 238.67
    // Exactly 238.5. As a float this is 238.4999…, which Math.round would take
    // down to 238 — the integer arithmetic gets it right.
    expect(scorePoints(1_431, 10)).toBe(239);
    expect(scorePoints(3, 10)).toBe(1); // 0.5 rounds up too
    expect(scorePoints(2, 10)).toBe(0); // 0.33 rounds down
  });

  it('scores a team with no headcount as zero rather than dividing by zero', () => {
    expect(formatScore(600, null)).toBe('0');
    expect(formatScore(600, 0)).toBe('0');
  });

  it('measures the gap to the cut line between the two displayed scores', () => {
    const ahead = { totalMinutes: 1_431, headcount: 10 }; // shows 239
    const behind = { totalMinutes: 600, headcount: 10 }; // shows 100
    expect(scoreGap(ahead, behind)).toBe(139);
    expect(scoreGap(behind, ahead)).toBe(139);
    // Two teams can show the same score while tie-breakers still separate them.
    expect(scoreGap({ totalMinutes: 1_430, headcount: 10 }, { totalMinutes: 1_429, headcount: 10 })).toBe(0);
  });

  it('never changes the ranking — the displayed scores sort in rank order', () => {
    const entries = teams.map((t, i) =>
      entry({ teamId: t.id, durationMinutes: 137 * (i + 1) + (i % 3) * 11 }),
    );
    const list = standings({ entries });
    const shown = list.map((s) => Number(formatScore(s.totalMinutes, s.headcount)));
    expect(shown).toEqual([...shown].sort((a, b) => b - a));
  });
});

describe('individual score', () => {
  it('totals only counted entries inside the scope', () => {
    const entries = [
      entry({ teamId: teamId('Ireland'), userId: 'u1', durationMinutes: 90 }),
      entry({ teamId: teamId('Ireland'), userId: 'u1', durationMinutes: 45 }),
      entry({ teamId: teamId('Ireland'), userId: 'u1', durationMinutes: 600, status: 'pending' }),
      entry({ teamId: teamId('Ireland'), userId: 'u1', durationMinutes: 600, status: 'rejected' }),
      // Dated inside round 2, so it must not count towards round 1.
      entry({ teamId: teamId('Ireland'), userId: 'u1', durationMinutes: 600, completedOn: '2027-02-01' }),
    ];

    const [top] = computeIndividualStandings({ entries, members: [], round: round1 });
    expect(top.userId).toBe('u1');
    expect(top.totalMinutes).toBe(135);
    expect(formatHours(top.totalMinutes)).toBe('2.3');
  });

  it('gives tied users the same rank', () => {
    const entries = [
      entry({ teamId: teamId('Ireland'), userId: 'a', durationMinutes: 300 }),
      entry({ teamId: teamId('Ireland'), userId: 'b', durationMinutes: 200 }),
      entry({ teamId: teamId('Ireland'), userId: 'c', durationMinutes: 200 }),
      entry({ teamId: teamId('Ireland'), userId: 'd', durationMinutes: 100 }),
    ];

    const ranks = computeIndividualStandings({ entries, members: [], round: round1 });
    expect(ranks.map((r) => [r.userId, r.rank])).toEqual([
      ['a', 1],
      ['b', 2],
      ['c', 2],
      ['d', 4],
    ]);
  });
});

describe('team score', () => {
  it('is total counted minutes divided by headcount', () => {
    const entries = [
      entry({ teamId: teamId('Mpesa'), userId: 'm1', durationMinutes: 600 }),
      entry({ teamId: teamId('Mpesa'), userId: 'm2', durationMinutes: 600 }),
    ];

    const mpesa = row(standings({ entries }), 'Mpesa');
    expect(mpesa.totalMinutes).toBe(1_200);
    expect(mpesa.headcount).toBe(10);
    expect(formatScore(mpesa.totalMinutes, mpesa.headcount)).toBe('200');
  });

  it('counts an entry against the team the user was in at the time, not their new team', () => {
    // u1 logged 10 hours for Ireland, then moved to Mpesa and logged 1 more.
    const entries = [
      entry({ teamId: teamId('Ireland'), userId: 'mover', durationMinutes: 600 }),
      entry({ teamId: teamId('Mpesa'), userId: 'mover', durationMinutes: 60 }),
    ];

    // Their *current* membership is Mpesa.
    const movedMembers = members.map((m) =>
      m.userId === 'ireland-u1' ? { ...m, userId: 'mover', teamId: teamId('Mpesa') } : m,
    );

    const list = standings({ entries, members: movedMembers });
    expect(row(list, 'Ireland').totalMinutes).toBe(600);
    expect(row(list, 'Mpesa').totalMinutes).toBe(60);

    // And their own total follows the person, not the team.
    const individual = computeIndividualStandings({
      entries,
      members: movedMembers,
      round: round1,
      includeZero: false,
    });
    expect(individual.find((r) => r.userId === 'mover')?.totalMinutes).toBe(660);
  });
});

describe('headcount history', () => {
  const history: HeadcountRow[] = [
    { teamId: 'ireland', headcount: 10, effectiveFrom: '2026-10-01' },
    { teamId: 'ireland', headcount: 20, effectiveFrom: '2026-11-01' },
    { teamId: 'ireland', headcount: 40, effectiveFrom: '2027-02-01' },
  ];

  it('resolves the value in effect on a given date', () => {
    expect(resolveHeadcount(history, 'ireland', '2026-09-30')).toBeNull();
    expect(resolveHeadcount(history, 'ireland', '2026-10-31')).toBe(10);
    expect(resolveHeadcount(history, 'ireland', '2026-11-01')).toBe(20);
    expect(resolveHeadcount(history, 'ireland', '2027-03-31')).toBe(40);
  });

  it('changes a live score when the headcount changes mid-round', () => {
    const entries = [entry({ teamId: teamId('Ireland'), durationMinutes: 1_200 })];
    const withHistory = [...headcounts.filter((h) => h.teamId !== 'ireland'), ...history];

    const before = row(standings({ entries, headcounts: withHistory, today: '2026-10-20' }), 'Ireland');
    const after = row(standings({ entries, headcounts: withHistory, today: '2026-11-15' }), 'Ireland');

    expect(formatScore(before.totalMinutes, before.headcount)).toBe('200'); // 20 h ÷ 10 × 100
    expect(formatScore(after.totalMinutes, after.headcount)).toBe('100'); // 20 h ÷ 20 × 100
  });

  it('freezes a closed round against the headcount in effect on its last day', () => {
    const entries = [entry({ teamId: teamId('Ireland'), durationMinutes: 1_200 })];
    const withHistory = [...headcounts.filter((h) => h.teamId !== 'ireland'), ...history];
    const closed: RoundRow = { ...round1, status: 'closed' };

    // Today is deep into round 2, when Ireland's headcount is 40 — but round 1
    // ended on 2026-12-31, when it was 20.
    const frozen = row(
      standings({ entries, headcounts: withHistory, round: closed, today: '2027-03-01' }),
      'Ireland',
    );

    expect(frozen.headcount).toBe(20);
    expect(formatScore(frozen.totalMinutes, frozen.headcount)).toBe('100');
  });
});

describe('live divisions', () => {
  it('keeps the seeded starting divisions on day one, when every team is on zero', () => {
    const list = standings({ entries: [], today: '2026-10-01' });

    expect(list.filter((s) => s.division === 1).map((s) => s.teamName)).toEqual([
      'CIT',
      'MVA Germany',
      'Web factory',
      'DE enterprise',
      'Vodacom',
    ]);
    expect(list.every((s) => s.movement === 'stayed')).toBe(true);
  });

  it('promotes a team the moment its score crosses the cut line', () => {
    // Every Division 1 team logs 10 hours/person; Division 2 logs nothing.
    const base = teams
      .filter((t) => round1StartDivisions.find((d) => d.teamId === t.id)?.division === 1)
      .map((t) => entry({ teamId: t.id, durationMinutes: 6_000 }));

    const before = standings({ entries: base });
    expect(row(before, 'OneApp').division).toBe(2);
    expect(row(before, 'OneApp').movement).toBe('stayed');

    // OneApp (Division 2) now out-scores the weakest Division 1 team.
    const after = standings({
      entries: [...base, entry({ teamId: teamId('OneApp'), durationMinutes: 6_060 })],
    });

    const oneApp = row(after, 'OneApp');
    expect(oneApp.division).toBe(1);
    expect(oneApp.movement).toBe('promoted');

    // Exactly one team was pushed the other way, and it is badged as relegated.
    const relegated = after.filter((s) => s.movement === 'relegated');
    expect(relegated).toHaveLength(1);
    expect(relegated[0].division).toBe(2);
  });

  it('reports how far each team is from the cut line', () => {
    const entries = teams.map((t, i) =>
      entry({ teamId: t.id, durationMinutes: (teams.length - i) * 600 }),
    );
    const list = standings({ entries });

    const lastInD1 = list[4];
    const firstInD2 = list[5];

    // The team just above the line is clear of it by exactly the margin the
    // team just below it is short by.
    expect(lastInD1.gapToCutLine).toBeGreaterThan(0);
    expect(firstInD2.gapToCutLine).toBeLessThan(0);
    expect(lastInD1.gapToCutLine).toBeCloseTo(-firstInD2.gapToCutLine, 10);
  });

  it('never lets a team with no headcount outrank one that scored', () => {
    const entries = [entry({ teamId: teamId('Ireland'), durationMinutes: 60 })];
    const noHeadcount = headcounts.filter((h) => h.teamId !== teamId('Vodacom'));

    const list = standings({ entries, headcounts: noHeadcount });
    expect(row(list, 'Vodacom').headcount).toBeNull();
    expect(row(list, 'Ireland').rankOverall).toBeLessThan(row(list, 'Vodacom').rankOverall);
  });
});

describe('tie-breakers', () => {
  it('1. ranks by score per person, not by raw hours', () => {
    // Mpesa logs more hours, but Ireland has half the people.
    const entries = [
      entry({ teamId: teamId('Ireland'), durationMinutes: 1_000 }),
      entry({ teamId: teamId('Mpesa'), durationMinutes: 1_800 }),
    ];
    const withSmallIreland = [
      ...headcounts.filter((h) => h.teamId !== teamId('Ireland')),
      { teamId: teamId('Ireland'), headcount: 5, effectiveFrom: '2026-10-01' },
    ];

    const list = standings({ entries, headcounts: withSmallIreland });
    expect(row(list, 'Ireland').rankOverall).toBeLessThan(row(list, 'Mpesa').rankOverall);
  });

  it('2. breaks an equal score by higher total hours', () => {
    // Both score 1.00 h/person, but Mpesa has twice the people and twice the hours.
    const entries = [
      entry({ teamId: teamId('Ireland'), durationMinutes: 300 }),
      entry({ teamId: teamId('Mpesa'), durationMinutes: 600 }),
    ];
    const adjusted = [
      ...headcounts.filter((h) => h.teamId !== teamId('Ireland')),
      { teamId: teamId('Ireland'), headcount: 5, effectiveFrom: '2026-10-01' },
    ];

    const list = standings({ entries, headcounts: adjusted });
    expect(row(list, 'Ireland').gapToCutLine).toBeDefined();
    expect(row(list, 'Mpesa').rankOverall).toBeLessThan(row(list, 'Ireland').rankOverall);
  });

  it('3. breaks an equal score and equal hours by participation rate', () => {
    // Identical totals and headcounts; Mpesa spread its hours over 4 people,
    // Ireland over 2.
    const entries = [
      ...[1, 2].map((i) =>
        entry({ teamId: teamId('Ireland'), userId: `ireland-u${i}`, durationMinutes: 300 }),
      ),
      ...[1, 2, 3, 4].map((i) =>
        entry({ teamId: teamId('Mpesa'), userId: `mpesa-u${i}`, durationMinutes: 150 }),
      ),
    ];

    const list = standings({ entries });
    const ireland = row(list, 'Ireland');
    const mpesa = row(list, 'Mpesa');

    expect(ireland.totalMinutes).toBe(mpesa.totalMinutes);
    expect(ireland.headcount).toBe(mpesa.headcount);
    expect(mpesa.participationNumerator).toBe(4);
    expect(ireland.participationNumerator).toBe(2);
    expect(mpesa.rankOverall).toBeLessThan(ireland.rankOverall);
  });

  it('4. breaks a total tie by where the teams stood when the round opened', () => {
    // Nobody has scored, so only the round-start standing separates them.
    const list = standings({ entries: [] });
    const retail = row(list, 'CIT'); // started rank 1
    const uk = row(list, 'UK MVA/Web'); // started rank 6

    expect(retail.rankOverall).toBeLessThan(uk.rankOverall);
    // Alphabetically "CIT" would lose to "DE enterprise"; it does not,
    // because the round-start rank is checked first.
    expect(retail.rankOverall).toBeLessThan(row(list, 'DE enterprise').rankOverall);
  });

  it('5. falls back to alphabetical order when there is no prior standing', () => {
    const list = computeTeamStandings({
      teams,
      entries: [],
      headcounts,
      members,
      round: round1,
      roundStartDivisions: [], // brand-new tournament, no baseline at all
      today: TODAY,
      division1Size: 5,
    });

    expect(list.map((s) => s.teamName)).toEqual(
      [...teams.map((t) => t.name)].sort((a, b) => a.localeCompare(b)),
    );
  });
});

describe('closing a round', () => {
  const entries = teams.map((t, i) =>
    entry({ teamId: t.id, durationMinutes: (teams.length - i) * 600 }),
  );

  it('freezes exactly what the preview showed', () => {
    const live = standings({ entries });
    const individual = computeIndividualStandings({ entries, members, round: round1 });

    const preview = buildRoundClosePreview(round1, live, individual);

    expect(preview.teamResults.map((t) => t.teamId)).toEqual(live.map((s) => s.teamId));
    expect(preview.teamResults.map((t) => t.finalDivision)).toEqual(live.map((s) => s.division));
    expect(preview.promoted.every((t) => t.finalDivision === 1)).toBe(true);
    expect(preview.relegated.every((t) => t.finalDivision === 2)).toBe(true);
  });

  it('hands the next round a baseline matching the final table', () => {
    const live = standings({ entries });
    const preview = buildRoundClosePreview(round1, live, []);

    expect(preview.nextRoundStartDivisions).toEqual(
      live.map((s) => ({ teamId: s.teamId, division: s.division, rank: s.rankOverall })),
    );
    expect(preview.nextRoundStartDivisions.filter((d) => d.division === 1)).toHaveLength(5);
  });

  it('accounts for every team as promoted, relegated or unchanged', () => {
    const preview = buildRoundClosePreview(round1, standings({ entries }), []);
    const total =
      preview.promoted.length + preview.relegated.length + preview.unchanged.length;

    expect(total).toBe(teams.length);
    // With a live cut line, movement is symmetric: as many up as down.
    expect(preview.promoted).toHaveLength(preview.relegated.length);
  });
});
