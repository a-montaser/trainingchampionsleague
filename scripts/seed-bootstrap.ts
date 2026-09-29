/**
 * Bootstraps the tournament: the 10 teams, their starting headcounts, the
 * settings row, the round schedule, and Round 1's starting divisions.
 *
 *   npm run db:seed         Real dates: 1 Oct 2026 → 31 Mar 2027.
 *   npm run db:seed:demo    Demo dates: the tournament starts 30 days ago, so
 *                           Round 1 is open today and trainings can be logged.
 *   npm run db:seed:real    Switch a demo database back to the real dates.
 *
 * Safe to re-run. Teams, headcounts and entries are never overwritten; only
 * `--demo` and `--real` rewrite the settings and the round schedule, and both
 * refuse to run once a round has been closed.
 *
 * The full demo seed (fake participants and entries, an admin account) is a
 * separate script in Phase 5.
 */
import { config } from 'dotenv';
import { eq, sql } from 'drizzle-orm';
import { drizzle as drizzleNeon } from 'drizzle-orm/neon-serverless';
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import type { Pool as NeonPool } from '@neondatabase/serverless';
import type { Pool as TcpPool } from 'pg';
import { createPool, isNeonUrl } from '../src/db/driver';
import {
  entries,
  roundStartDivisions,
  rounds,
  settings,
  teamHeadcounts,
  teams,
} from '../src/db/schema';
import { planRounds } from '../src/lib/scoring/schedule';
import { isWithin, todayInCairo, type DateOnly } from '../src/lib/time';

config({ path: '.env.local', quiet: true });
config({ path: '.env', quiet: true });

const REAL_START = '2026-10-01';
const REAL_END = '2027-03-31';
const ROUND_LENGTH_MONTHS = 3;
const DEFAULT_HEADCOUNT = 10;

/** How far back a demo tournament starts, so there is room to log past dates. */
const DEMO_LEAD_IN_DAYS = 30;

/** Division 1 first, in the order the tournament settings list them. */
const STARTING_DIVISION_1 = [
  'CIT',
  'MVA Germany',
  'Web factory',
  'DE enterprise',
  'Vodacom',
];

const STARTING_DIVISION_2 = ['UK MVA/Web', 'Ireland', 'OneApp', 'Mpesa', 'DE portals'];

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function shiftDays(date: DateOnly, days: number): DateOnly {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000)
    .toISOString()
    .slice(0, 10);
}

function shiftMonths(date: DateOnly, months: number): DateOnly {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1 + months, d)).toISOString().slice(0, 10);
}

/** Two rounds of three months, arranged so today falls inside Round 1. */
function demoWindow(): { start: DateOnly; end: DateOnly } {
  const start = shiftDays(todayInCairo(), -DEMO_LEAD_IN_DAYS);
  return { start, end: shiftDays(shiftMonths(start, ROUND_LENGTH_MONTHS * 2), -1) };
}

async function main() {
  const mode = process.argv.includes('--demo')
    ? 'demo'
    : process.argv.includes('--real')
      ? 'real'
      : 'bootstrap';

  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set. Copy .env.example to .env.local first.');

  const pool = createPool(url, 1);
  const db = isNeonUrl(url) ? drizzleNeon(pool as NeonPool) : drizzlePg(pool as TcpPool);

  try {
    const window = mode === 'demo' ? demoWindow() : { start: REAL_START, end: REAL_END };
    const today = todayInCairo();

    // 1. Teams, in their listed order so Division 1 seeds correctly.
    await db
      .insert(teams)
      .values(
        [...STARTING_DIVISION_1, ...STARTING_DIVISION_2].map((name) => ({
          name,
          slug: slugify(name),
        })),
      )
      .onConflictDoNothing({ target: teams.name });

    const teamRows = await db.select().from(teams);
    const byName = new Map(teamRows.map((t) => [t.name, t]));
    console.log(`Teams: ${teamRows.length}`);

    // 2. A starting headcount for each. Never overwritten — headcount history
    //    is append-only, so an existing value always wins.
    await db
      .insert(teamHeadcounts)
      .values(
        teamRows.map((team) => ({
          teamId: team.id,
          headcount: DEFAULT_HEADCOUNT,
          effectiveFrom: window.start,
        })),
      )
      .onConflictDoNothing();

    // 3. Settings.
    await db
      .insert(settings)
      .values({
        id: 1,
        tournamentStart: window.start,
        tournamentEnd: window.end,
        approvalRequired: false,
        maxEntryMinutes: null,
        dailyFlagMinutes: 600,
        division1Size: STARTING_DIVISION_1.length,
        timezone: 'Africa/Cairo',
      })
      .onConflictDoNothing({ target: settings.id });

    if (mode !== 'bootstrap') {
      await db
        .update(settings)
        .set({ tournamentStart: window.start, tournamentEnd: window.end, updatedAt: new Date() })
        .where(eq(settings.id, 1));
    }

    // 4. Rounds. Only rebuilt on a first run, or when switching date mode.
    const existingRounds = await db.select().from(rounds);

    if (existingRounds.length === 0 || mode !== 'bootstrap') {
      if (existingRounds.some((r) => r.status === 'closed')) {
        throw new Error(
          'A round has already been closed. Refusing to rewrite the schedule, because that ' +
            'would invalidate frozen results.',
        );
      }

      const [entryCount] = await db.select({ total: sql<number>`count(*)::int` }).from(entries);
      if (entryCount?.total) {
        console.warn(
          `WARNING: ${entryCount.total} entries exist. Any dated outside the new round dates ` +
            'will stop counting.',
        );
      }

      const plan = planRounds(window.start, window.end, ROUND_LENGTH_MONTHS);

      await db.delete(roundStartDivisions);
      await db.delete(rounds);
      await db.insert(rounds).values(
        plan.map((p) => ({
          index: p.index,
          name: p.name,
          startsOn: p.startsOn,
          endsOn: p.endsOn,
          // Whichever round contains today is the one that is open.
          status: isWithin(today, p.startsOn, p.endsOn) ? ('open' as const) : ('scheduled' as const),
        })),
      );

      // If the whole tournament is still in the future, open Round 1 anyway so
      // the schedule is visible rather than inert.
      if (!plan.some((p) => isWithin(today, p.startsOn, p.endsOn))) {
        await db.update(rounds).set({ status: 'open' }).where(eq(rounds.index, 1));
      }

      console.log(`Rounds (${mode}): ${plan.map((p) => `${p.startsOn}→${p.endsOn}`).join(', ')}`);
    } else {
      console.log(`Rounds: ${existingRounds.length} (already present, left alone)`);
    }

    // 5. Round 1's starting divisions — the baseline that keeps the seeded
    //    split intact until someone actually logs a training.
    const [firstRound] = await db.select().from(rounds).where(eq(rounds.index, 1));
    if (firstRound) {
      const existing = await db
        .select()
        .from(roundStartDivisions)
        .where(eq(roundStartDivisions.roundId, firstRound.id));

      if (existing.length === 0) {
        const assignments = [
          ...STARTING_DIVISION_1.map((name, i) => ({ name, division: 1, rank: i + 1 })),
          ...STARTING_DIVISION_2.map((name, i) => ({ name, division: 2, rank: 6 + i })),
        ];

        await db.insert(roundStartDivisions).values(
          assignments.map((a) => {
            const team = byName.get(a.name);
            if (!team) throw new Error(`Team "${a.name}" is missing.`);
            return {
              roundId: firstRound.id,
              teamId: team.id,
              division: a.division,
              rank: a.rank,
            };
          }),
        );
        console.log('Round 1 starting divisions written.');
      } else {
        console.log('Round 1 starting divisions already present, left alone.');
      }
    }

    if (mode === 'demo') {
      console.log(
        `\nDemo dates active — log trainings dated ${window.start} to ${today}.` +
          '\nRestore the real dates with: npm run db:seed:real',
      );
    } else {
      console.log(`\nTournament dates: ${window.start} → ${window.end}.`);
    }
    console.log('Register at http://localhost:3000/register');
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
