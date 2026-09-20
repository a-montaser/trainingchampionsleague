import 'server-only';
import { eq } from 'drizzle-orm';
import { db, type Executor } from '../../db';
import { settings } from '../../db/schema';
import type { Actor } from '../auth/guards';
import { assertAdmin } from '../auth/guards';
import { recordAudit } from './audit';

export const SETTINGS_ID = 1;

export interface TournamentSettings {
  approvalRequired: boolean;
  maxEntryMinutes: number | null;
  dailyFlagMinutes: number;
  division1Size: number;
  tournamentStart: string;
  tournamentEnd: string;
  timezone: string;
}

export async function getSettings(exec: Executor = db): Promise<TournamentSettings> {
  const [row] = await exec.select().from(settings).where(eq(settings.id, SETTINGS_ID)).limit(1);
  if (!row) {
    throw new Error('Tournament settings are missing. Run the seed script first.');
  }

  return {
    approvalRequired: row.approvalRequired,
    maxEntryMinutes: row.maxEntryMinutes,
    dailyFlagMinutes: row.dailyFlagMinutes,
    division1Size: row.division1Size,
    tournamentStart: row.tournamentStart,
    tournamentEnd: row.tournamentEnd,
    timezone: row.timezone,
  };
}

export type SettingsPatch = Partial<
  Pick<
    TournamentSettings,
    'approvalRequired' | 'maxEntryMinutes' | 'dailyFlagMinutes' | 'division1Size'
  >
>;

export async function updateSettings(
  actor: Actor,
  patch: SettingsPatch,
): Promise<TournamentSettings> {
  assertAdmin(actor);

  if (patch.division1Size !== undefined && (patch.division1Size < 1 || patch.division1Size > 9)) {
    throw new Error('Division 1 must hold between 1 and 9 teams.');
  }
  if (patch.maxEntryMinutes !== undefined && patch.maxEntryMinutes !== null && patch.maxEntryMinutes < 1) {
    throw new Error('The maximum entry duration must be at least 1 minute, or left empty for no cap.');
  }
  if (patch.dailyFlagMinutes !== undefined && patch.dailyFlagMinutes < 1) {
    throw new Error('The daily highlight threshold must be at least 1 minute.');
  }

  return db.transaction(async (tx) => {
    const before = await getSettings(tx);

    await tx
      .update(settings)
      .set({ ...patch, updatedAt: new Date(), updatedByUserId: actor.id })
      .where(eq(settings.id, SETTINGS_ID));

    const after = await getSettings(tx);
    await recordAudit(tx, {
      actorId: actor.id,
      action: 'settings.update',
      entityType: 'settings',
      entityId: String(SETTINGS_ID),
      before,
      after,
    });

    return after;
  });
}
