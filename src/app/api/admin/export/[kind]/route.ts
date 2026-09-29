import { requireAdminApi } from '@/lib/auth/dal';
import { AuthError } from '@/lib/auth/guards';
import { csvResponse, toCsv, type CsvRow } from '@/lib/csv';
import { formatHours, scorePoints } from '@/lib/scoring';
import { exportEntries } from '@/lib/services/entries';
import { getCurrentRound, getRound, listRounds } from '@/lib/services/rounds';
import { loadIndividualStandings, loadTeamStandings } from '@/lib/services/standings';
import { todayInCairo } from '@/lib/time';

/**
 * CSV exports for organisers.
 *
 * A route handler rather than a server action, because a download needs a real
 * HTTP response. Authorisation uses `requireAdminApi`, which throws with a
 * status instead of redirecting — a participant hitting this gets 403, not a
 * login page disguised as a spreadsheet.
 */
export async function GET(request: Request, context: RouteContext<'/api/admin/export/[kind]'>) {
  let actor;
  try {
    actor = await requireAdminApi();
  } catch (error) {
    if (error instanceof AuthError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }

  const { kind } = await context.params;
  const roundId = new URL(request.url).searchParams.get('round') ?? undefined;
  const today = todayInCairo();

  if (kind === 'entries') {
    const rows = await exportEntries(actor, roundId ? { roundIds: [roundId] } : {});
    const rounds = await listRounds();
    const roundName = new Map(rounds.map((r) => [r.id, r.name]));

    const csv = toCsv(
      rows.map<CsvRow>((entry) => ({
        Date: entry.completedOn,
        Name: entry.userName,
        Team: entry.teamName ?? '',
        Round: entry.roundId ? (roundName.get(entry.roundId) ?? '') : '',
        Training: entry.trainingName,
        Link: entry.trainingUrl,
        Minutes: entry.durationMinutes,
        Hours: formatHours(entry.durationMinutes),
        Status: entry.status,
        Notes: entry.notes ?? '',
        'Logged at': entry.createdAt.toISOString(),
      })),
      [
        'Date',
        'Name',
        'Team',
        'Round',
        'Training',
        'Link',
        'Minutes',
        'Hours',
        'Status',
        'Notes',
        'Logged at',
      ],
    );

    return csvResponse(csv, `entries-${today}.csv`);
  }

  if (kind === 'leaderboard') {
    const round = roundId ? await getRound(roundId) : undefined;
    const rows = await loadIndividualStandings(round ? { round } : {});

    const csv = toCsv(
      rows.map<CsvRow>((row) => ({
        Rank: row.rank,
        Name: row.fullName,
        Team: row.teamName ?? '',
        Minutes: row.totalMinutes,
        Hours: formatHours(row.totalMinutes),
      })),
      ['Rank', 'Name', 'Team', 'Minutes', 'Hours'],
    );

    return csvResponse(csv, `leaderboard-${round ? round.name.replace(/\s+/g, '-') : 'all'}-${today}.csv`);
  }

  if (kind === 'standings') {
    const round = roundId ? await getRound(roundId) : await getCurrentRound();
    if (!round) return Response.json({ error: 'No rounds exist yet.' }, { status: 404 });

    const rows = await loadTeamStandings(round);

    const csv = toCsv(
      rows.map<CsvRow>((row) => ({
        Rank: row.rankOverall,
        Team: row.teamName,
        Division: row.division,
        'Rank in division': row.rankInDivision,
        Minutes: row.totalMinutes,
        Hours: formatHours(row.totalMinutes),
        Headcount: row.headcount ?? '',
        Score: scorePoints(row.totalMinutes, row.headcount),
        Movement: row.movement,
        'Took part': row.participationNumerator,
        'Registered members': row.participationDenominator,
      })),
      [
        'Rank',
        'Team',
        'Division',
        'Rank in division',
        'Minutes',
        'Hours',
        'Headcount',
        'Score',
        'Movement',
        'Took part',
        'Registered members',
      ],
    );

    return csvResponse(csv, `standings-${round.name.replace(/\s+/g, '-')}-${today}.csv`);
  }

  return Response.json({ error: 'Unknown export.' }, { status: 404 });
}
