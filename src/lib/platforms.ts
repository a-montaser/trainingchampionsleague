/**
 * Where a training was taken. The value is what is stored; the label is what
 * people see. "Other" comes with a free-text name, stored separately so the
 * fixed choices stay easy to count and filter.
 */
export const PLATFORMS = [
  { value: 'percipio', label: 'Percipio' },
  { value: 'udemy', label: 'Udemy' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'linkedin_learning', label: 'LinkedIn Learning' },
  { value: 'in_office_workshop', label: 'In-Office workshop' },
  { value: 'online_workshop', label: 'Online Workshop' },
  { value: 'other', label: 'Other' },
] as const;

export type Platform = (typeof PLATFORMS)[number]['value'];

export const PLATFORM_VALUES = PLATFORMS.map((p) => p.value) as [Platform, ...Platform[]];

export const MAX_PLATFORM_OTHER_LENGTH = 100;

/**
 * How a stored platform reads on screen and in exports. Entries logged before
 * the field existed have none, so this returns an empty string for them.
 */
export function formatPlatform(platform: string | null, platformOther: string | null): string {
  if (!platform) return '';
  if (platform === 'other') return platformOther ? `Other: ${platformOther}` : 'Other';
  return PLATFORMS.find((p) => p.value === platform)?.label ?? platform;
}
