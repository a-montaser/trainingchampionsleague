'use client';

import { useState } from 'react';
import { PLATFORMS, MAX_PLATFORM_OTHER_LENGTH } from '@/lib/platforms';
import { Dropdown } from './Dropdown';
import { Field, Input } from './ui';

/**
 * The platform a training was taken on. Choosing "Other" reveals a text box
 * for its name, which is then required. Shared by the participant form and the
 * admin edit form so both submit the same `platform` / `platformOther` fields.
 */
export function PlatformField({
  idPrefix = '',
  defaultPlatform = '',
  defaultOther = '',
  error,
  otherError,
}: {
  /** Keeps ids unique when several forms share a page. */
  idPrefix?: string;
  defaultPlatform?: string;
  defaultOther?: string;
  error?: string;
  otherError?: string;
}) {
  const [platform, setPlatform] = useState(defaultPlatform);
  const platformId = `${idPrefix}platform`;
  const otherId = `${idPrefix}platformOther`;

  return (
    <>
      <Field label="Platform" htmlFor={platformId} error={error} required>
        <Dropdown
          id={platformId}
          name="platform"
          options={PLATFORMS.map(({ value, label }) => ({ value, label }))}
          value={platform}
          onChange={setPlatform}
          placeholder="Where did you take it?"
        />
      </Field>

      {platform === 'other' && (
        <Field label="Platform name" htmlFor={otherId} error={otherError} required>
          <Input
            id={otherId}
            name="platformOther"
            defaultValue={defaultOther}
            maxLength={MAX_PLATFORM_OTHER_LENGTH}
            placeholder="e.g. Coursera"
            required
            // Jump straight to the box when "Other" is picked, but not when an
            // entry that already says "Other" is opened for editing.
            autoFocus={defaultPlatform !== 'other'}
          />
        </Field>
      )}
    </>
  );
}
