'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireParticipant } from '@/lib/auth/dal';
import { AuthError } from '@/lib/auth/guards';
import {
  createEntry,
  deleteEntry,
  updateEntry,
  EntryValidationFailed,
  type EntryDraft,
} from '@/lib/services/entries';

export interface EntryFormState {
  errors?: Record<string, string>;
  message?: string;
}

function readDraft(formData: FormData): EntryDraft {
  const hours = Number(formData.get('hours') ?? 0);
  const minutes = Number(formData.get('minutes') ?? 0);

  return {
    trainingName: String(formData.get('trainingName') ?? ''),
    completedOn: String(formData.get('completedOn') ?? ''),
    durationMinutes:
      (Number.isFinite(hours) ? hours : 0) * 60 + (Number.isFinite(minutes) ? minutes : 0),
    trainingUrl: String(formData.get('trainingUrl') ?? '').trim(),
    platform: String(formData.get('platform') ?? ''),
    platformOther: String(formData.get('platformOther') ?? ''),
    notes: String(formData.get('notes') ?? ''),
  };
}

/**
 * Standings are recomputed on every request, so revalidating these paths is
 * what makes a new entry show up on both leaderboards immediately.
 */
function refreshViews() {
  revalidatePath('/dashboard');
  revalidatePath('/entries');
  revalidatePath('/leaderboard');
  revalidatePath('/standings');
}

export async function createEntryAction(
  _prev: EntryFormState,
  formData: FormData,
): Promise<EntryFormState> {
  const actor = await requireParticipant();

  try {
    await createEntry(actor, readDraft(formData));
  } catch (error) {
    if (error instanceof EntryValidationFailed) return { errors: error.errors };
    if (error instanceof AuthError) return { message: error.message };
    throw error;
  }

  refreshViews();
  redirect('/entries?saved=1');
}

export async function updateEntryAction(
  entryId: string,
  _prev: EntryFormState,
  formData: FormData,
): Promise<EntryFormState> {
  const actor = await requireParticipant();

  try {
    await updateEntry(actor, entryId, readDraft(formData));
  } catch (error) {
    if (error instanceof EntryValidationFailed) return { errors: error.errors };
    if (error instanceof AuthError) return { message: error.message };
    throw error;
  }

  refreshViews();
  redirect('/entries?updated=1');
}

export async function deleteEntryAction(formData: FormData): Promise<void> {
  const actor = await requireParticipant();
  const entryId = String(formData.get('entryId') ?? '');

  await deleteEntry(actor, entryId);

  refreshViews();
  redirect('/entries?deleted=1');
}
