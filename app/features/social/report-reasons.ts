// Report reasons and target types.
//
// Kept free of any Supabase import so this can be used (and tested) without
// constructing a client, which needs environment variables that do not exist
// in a unit-test run.
//
// The values here are constrained by a CHECK on content_reports.reason. If one
// changes, the other has to change with it.

export type ReportReason =
  | 'spam'
  | 'harassment'
  | 'hate'
  | 'violence'
  | 'sexual'
  | 'misinformation'
  | 'other';

export type ReportTargetType = 'trip' | 'comment' | 'profile';

/** Ordered for the picker — most-used first, 'other' last. */
export const REPORT_REASONS: { value: ReportReason; label: string; description: string }[] = [
  { value: 'spam', label: 'Spam or scam', description: 'Repetitive, misleading, or commercial' },
  { value: 'harassment', label: 'Harassment or bullying', description: 'Targets or threatens someone' },
  { value: 'hate', label: 'Hate speech', description: 'Attacks a group or protected characteristic' },
  { value: 'violence', label: 'Violence or self-harm', description: 'Graphic, threatening, or harmful' },
  { value: 'sexual', label: 'Sexual content', description: 'Nudity or sexually explicit material' },
  { value: 'misinformation', label: 'Misinformation', description: 'Knowingly false or deceptive' },
  { value: 'other', label: 'Something else', description: 'Tell us what is wrong' },
];
