import {
  buildFerryReviewStateSignature,
  buildSuspiciousFerryConfirmationMessage,
  getSuspiciousFerryReviews,
  getUnresolvedSuspiciousFerryReviews,
} from '@/features/trips/routing/ferry-review';

const marseilleStop = {
  cityName: 'Marseille',
  countryName: 'France',
  latitude: 43.2965,
  longitude: 5.3698,
};

const luzernStop = {
  cityName: 'Luzern',
  countryName: 'Switzerland',
  latitude: 47.0502,
  longitude: 8.3093,
};

const luganoStop = {
  cityName: 'Lugano',
  countryName: 'Switzerland',
  latitude: 46.0037,
  longitude: 8.9511,
};

const palmaStop = {
  cityName: 'Palma',
  countryName: 'Spain',
  latitude: 39.5696,
  longitude: 2.6502,
};

const valenciaStop = {
  cityName: 'Valencia',
  countryName: 'Spain',
  latitude: 39.4699,
  longitude: -0.3763,
};

describe('ferry review helpers', () => {
  it('flags long ferry legs into landlocked countries', () => {
    const reviews = getSuspiciousFerryReviews({
      stops: [marseilleStop, luzernStop],
      legs: [{ transportType: 'ferry', transportLabel: '' }],
      returnToStart: false,
      returnLeg: { transportType: 'plane', transportLabel: '' },
    });

    expect(reviews).toHaveLength(1);
    expect(reviews[0]).toMatchObject({
      segmentKind: 'leg',
      routeLabel: 'Marseille, France → Luzern, Switzerland',
      question: 'Are you sure you traveled by ferry from Marseille to Luzern?',
    });
    expect(reviews[0]?.explanation).toContain('landlocked Switzerland');
  });

  it('flags long inland ferry selections when both stops stay landlocked', () => {
    const reviews = getSuspiciousFerryReviews({
      stops: [luzernStop, luganoStop],
      legs: [{ transportType: 'ferry', transportLabel: '' }],
      returnToStart: false,
      returnLeg: { transportType: 'plane', transportLabel: '' },
    });

    expect(reviews).toHaveLength(1);
    expect(reviews[0]).toMatchObject({
      routeLabel: 'Luzern, Switzerland → Lugano, Switzerland',
      question: 'Are you sure you traveled by ferry from Luzern to Lugano?',
    });
    expect(reviews[0]?.explanation).toContain('landlocked Switzerland');
  });

  it('does not nag for obvious coastal or island ferry pairs', () => {
    const reviews = getSuspiciousFerryReviews({
      stops: [valenciaStop, palmaStop],
      legs: [{ transportType: 'ferry', transportLabel: 'Overnight ferry' }],
      returnToStart: false,
      returnLeg: { transportType: 'plane', transportLabel: '' },
    });

    expect(reviews).toEqual([]);
  });

  it('reviews suspicious return-to-start ferry legs too', () => {
    const reviews = getSuspiciousFerryReviews({
      stops: [luzernStop, marseilleStop],
      legs: [{ transportType: 'train', transportLabel: '' }],
      returnToStart: true,
      returnLeg: { transportType: 'ferry', transportLabel: 'Back north' },
    });

    expect(reviews).toHaveLength(1);
    expect(reviews[0]).toMatchObject({
      segmentKind: 'return',
      index: 1,
      question: 'Are you sure you traveled by ferry from Marseille to Luzern?',
    });
  });

  it('changes the confirmation reset signature when stops or transport change', () => {
    const baseSignature = buildFerryReviewStateSignature({
      stops: [marseilleStop, luzernStop],
      legs: [{ transportType: 'ferry', transportLabel: '' }],
      returnToStart: false,
      returnLeg: { transportType: 'plane', transportLabel: '' },
    });

    const reorderedSignature = buildFerryReviewStateSignature({
      stops: [luzernStop, marseilleStop],
      legs: [{ transportType: 'ferry', transportLabel: '' }],
      returnToStart: false,
      returnLeg: { transportType: 'plane', transportLabel: '' },
    });

    const changedTransportSignature = buildFerryReviewStateSignature({
      stops: [marseilleStop, luzernStop],
      legs: [{ transportType: 'train', transportLabel: '' }],
      returnToStart: false,
      returnLeg: { transportType: 'plane', transportLabel: '' },
    });

    expect(reorderedSignature).not.toBe(baseSignature);
    expect(changedTransportSignature).not.toBe(baseSignature);
  });

  it('builds a batched confirmation message for suspicious ferry legs', () => {
    const reviews = getSuspiciousFerryReviews({
      stops: [marseilleStop, luzernStop],
      legs: [{ transportType: 'ferry', transportLabel: '' }],
      returnToStart: true,
      returnLeg: { transportType: 'ferry', transportLabel: '' },
    });

    const message = buildSuspiciousFerryConfirmationMessage(reviews);

    expect(message).toContain('These ferry legs look unlikely.');
    expect(message).toContain('Are you sure you traveled by ferry from Marseille to Luzern?');
    expect(message).toContain('Are you sure you traveled by ferry from Luzern to Marseille?');
    expect(message).toContain('Tap "Keep ferry" only if this was intentional.');
  });

  it('suppresses already-confirmed suspicious ferry reviews until the route changes', () => {
    const input: Parameters<typeof getSuspiciousFerryReviews>[0] = {
      stops: [marseilleStop, luzernStop],
      legs: [{ transportType: 'ferry', transportLabel: '' }],
      returnToStart: false,
      returnLeg: { transportType: 'plane', transportLabel: '' },
    };

    const initialReviews = getSuspiciousFerryReviews(input);

    expect(initialReviews).toHaveLength(1);
    expect(getUnresolvedSuspiciousFerryReviews(input, [])).toHaveLength(1);
    expect(getUnresolvedSuspiciousFerryReviews(input, [initialReviews[0]!.key])).toEqual([]);

    const changedInput: Parameters<typeof getSuspiciousFerryReviews>[0] = {
      ...input,
      legs: [{ transportType: 'ferry', transportLabel: 'Harbor transfer' }],
    };

    expect(buildFerryReviewStateSignature(changedInput)).not.toBe(buildFerryReviewStateSignature(input));
    expect(getUnresolvedSuspiciousFerryReviews(changedInput, [])).toHaveLength(1);
  });
});
