import { getTransportDisplay } from '@/features/trips/types';

describe('transport display metadata', () => {
  it('returns clean labels and icons for the expanded transport modes', () => {
    expect(getTransportDisplay('walking')).toEqual({
      label: 'Walking',
      emoji: '🚶',
      dashed: true,
    });
    expect(getTransportDisplay('bicycle')).toEqual({
      label: 'Bicycle',
      emoji: '🚲',
      dashed: true,
    });
    expect(getTransportDisplay('motorcycle')).toEqual({
      label: 'Motorcycle',
      emoji: '🏍️',
      dashed: false,
    });
  });

  it('still lets custom labels override the default display name', () => {
    expect(getTransportDisplay('bicycle', 'Sunrise coastal ride').label).toBe('Sunrise coastal ride');
  });
});
