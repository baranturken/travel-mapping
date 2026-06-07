import { getFirstTripFormErrorSection } from '@/features/trips/form-error-navigation';

describe('getFirstTripFormErrorSection', () => {
  it('prioritizes the title section', () => {
    const section = getFirstTripFormErrorSection({
      title: { type: 'required', message: 'Enter a trip title.' },
      stops: [{ cityName: { type: 'required', message: 'This field is required.' } }],
    } as never);

    expect(section).toBe('title');
  });

  it('returns the dates section for date errors', () => {
    const section = getFirstTripFormErrorSection({
      endDate: { type: 'custom', message: 'Add an end date too.' },
    } as never);

    expect(section).toBe('dates');
  });

  it('returns the stops section for nested stop errors', () => {
    const section = getFirstTripFormErrorSection({
      stops: [{ cityName: { type: 'required', message: 'This field is required.' } }],
    } as never);

    expect(section).toBe('stops');
  });

  it('returns the legs section for return-leg errors', () => {
    const section = getFirstTripFormErrorSection({
      returnLeg: {
        transportLabel: { type: 'custom', message: 'Add a custom transport label.' },
      },
    } as never);

    expect(section).toBe('legs');
  });
});
