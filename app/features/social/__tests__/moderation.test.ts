import { REPORT_REASONS } from '@/features/social/report-reasons';

// The report reasons are a product surface as much as a data one: they are what
// a reviewer sees when they open the app, and they are constrained by a CHECK
// on content_reports.reason. Drift between the two would fail at insert time,
// in front of a user who is already reporting something upsetting.
const REASONS_IN_DB_CHECK = [
  'spam',
  'harassment',
  'hate',
  'violence',
  'sexual',
  'misinformation',
  'other',
] as const;

describe('REPORT_REASONS', () => {
  it('matches the reasons the database accepts', () => {
    expect([...REPORT_REASONS.map((r) => r.value)].sort()).toEqual([...REASONS_IN_DB_CHECK].sort());
  });

  it('has no duplicates', () => {
    const values = REPORT_REASONS.map((r) => r.value);
    expect(new Set(values).size).toBe(values.length);
  });

  it('gives every reason a label and a description', () => {
    for (const reason of REPORT_REASONS) {
      expect(reason.label.length).toBeGreaterThan(0);
      expect(reason.description.length).toBeGreaterThan(0);
    }
  });

  it('covers the categories app review expects to see', () => {
    // Apple guideline 1.2 is about objectionable content; a reason list that
    // omits harassment or hate speech reads as not taking it seriously.
    const values = REPORT_REASONS.map((r) => r.value);
    for (const required of ['harassment', 'hate', 'sexual', 'violence', 'spam']) {
      expect(values).toContain(required);
    }
  });

  it('lists "other" last so it does not absorb reports that have a real category', () => {
    expect(REPORT_REASONS[REPORT_REASONS.length - 1].value).toBe('other');
  });
});
