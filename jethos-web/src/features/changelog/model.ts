import type { Changelog } from '../../content/schemas';

type ChangelogEntry = Changelog['entries'][number];

const typePresentation = {
  website: { label: 'Website', badge: 'implemented' },
  documentation: { label: 'Documentation', badge: 'implemented' },
  experience: { label: 'Experience', badge: 'implemented' },
  deployment: { label: 'Deployment record', badge: 'poc' },
} as const;

export interface ChangelogItem extends ChangelogEntry {
  badge: 'implemented' | 'poc';
  displayDate: string;
  typeLabel: string;
}

export function toChangelogItems(changelog: Changelog): ChangelogItem[] {
  return changelog.entries.map((entry) => {
    const presentation = typePresentation[entry.type];
    const displayDate = new Intl.DateTimeFormat('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    })
      .format(new Date(`${entry.date}T00:00:00Z`))
      .toUpperCase();

    return {
      ...entry,
      badge: presentation.badge,
      displayDate,
      typeLabel: presentation.label,
    };
  });
}
