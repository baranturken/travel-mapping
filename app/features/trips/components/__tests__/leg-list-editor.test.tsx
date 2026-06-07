import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import type { FieldErrors } from 'react-hook-form';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';

import { LegListEditor } from '@/features/trips/components/leg-list-editor';
import { createDefaultReturnLeg, createEmptyLeg, type CreateTripFormValues } from '@/features/trips/schemas';

const mockReact = React;
const originalConsoleError = console.error;

jest.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
    select: <T,>(options: { ios?: T; default?: T; web?: T }) =>
      options.ios ?? options.default ?? options.web,
  },
  Pressable: (props: Record<string, unknown> & { children?: React.ReactNode }) =>
    mockReact.createElement('Pressable', props, props.children),
  StyleSheet: {
    create: <T,>(styles: T) => styles,
  },
  Switch: (props: Record<string, unknown>) => mockReact.createElement('Switch', props),
  Text: (props: Record<string, unknown> & { children?: React.ReactNode }) =>
    mockReact.createElement('Text', props, props.children),
  TextInput: (props: Record<string, unknown>) => mockReact.createElement('TextInput', props),
  View: (props: Record<string, unknown> & { children?: React.ReactNode }) =>
    mockReact.createElement('View', props, props.children),
}));

function getNodeText(children: React.ReactNode): string {
  if (Array.isArray(children)) {
    return children.map((child) => getNodeText(child)).join('');
  }

  if (typeof children === 'string' || typeof children === 'number') {
    return String(children);
  }

  if (React.isValidElement(children)) {
    return getNodeText((children.props as { children?: React.ReactNode }).children);
  }

  return '';
}

function findAllPressablesByText(renderer: TestRenderer.ReactTestRenderer, text: string) {
  return renderer.root
    .findAll((node) => typeof node.props === 'object' && node.props !== null && 'onPress' in node.props)
    .filter((node) =>
      node.findAll((child) => getNodeText(child.props.children).includes(text)).length > 0,
    );
}

function hasText(renderer: TestRenderer.ReactTestRenderer, text: string) {
  return renderer.root.findAll((node) => getNodeText(node.props.children).includes(text)).length > 0;
}

function TransportHarness() {
  const form = useForm<CreateTripFormValues>({
    defaultValues: {
      title: 'Coast loop',
      startDate: '',
      endDate: '',
      stops: [
        {
          cityName: 'Barcelona',
          countryName: 'Spain',
          isHomeBase: false,
          stayLabel: '',
          accommodationName: '',
          accommodationType: '',
          accommodationNote: '',
          latitude: '41.3851',
          longitude: '2.1734',
          places: [],
          memories: [],
        },
        {
          cityName: 'Girona',
          countryName: 'Spain',
          isHomeBase: false,
          stayLabel: '',
          accommodationName: '',
          accommodationType: '',
          accommodationNote: '',
          latitude: '41.9794',
          longitude: '2.8214',
          places: [],
          memories: [],
        },
      ],
      legs: [createEmptyLeg('walking')],
      returnToStart: false,
      returnLeg: createDefaultReturnLeg(),
    },
  });

  const legArray = useFieldArray({
    control: form.control,
    name: 'legs',
  });
  const stopValues = useWatch({
    control: form.control,
    name: 'stops',
  });
  const returnToStart = useWatch({
    control: form.control,
    name: 'returnToStart',
  });
  const legType = useWatch({
    control: form.control,
    name: 'legs.0.transportType',
  });
  const returnLegType = useWatch({
    control: form.control,
    name: 'returnLeg.transportType',
  });

  return (
    <>
      <LegListEditor
        control={form.control}
        errors={{} as FieldErrors<CreateTripFormValues>}
        legFields={legArray.fields}
        stopValues={stopValues}
        returnToStart={returnToStart ?? false}
        suspiciousFerryReviewsByIndex={{}}
        suspiciousReturnFerryReview={null}
        confirmedSuspiciousFerryKeySet={new Set()}
        onConfirmSuspiciousFerryReview={() => {}}
      />
      {mockReact.createElement('Text', { testID: 'leg-type' }, legType)}
      {mockReact.createElement('Text', { testID: 'return-leg-type' }, returnLegType)}
    </>
  );
}

describe('LegListEditor transport options', () => {
  beforeAll(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });

  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
      const firstArgument = args[0];

      if (
        typeof firstArgument === 'string' &&
        firstArgument.includes('react-test-renderer is deprecated')
      ) {
        return;
      }

      originalConsoleError(...args);
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('offers the new transport modes for the main leg and return leg selection', () => {
    let renderer: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(<TransportHarness />);
    });

    expect(hasText(renderer!, '🚶 Walking')).toBe(true);
    expect(hasText(renderer!, '🚲 Bicycle')).toBe(true);
    expect(hasText(renderer!, '🏍️ Motorcycle')).toBe(true);
    expect(hasText(renderer!, 'How did you go from Girona to Barcelona?')).toBe(false);

    const toggle = renderer!.root.find(
      (node) => typeof node.props === 'object' && node.props !== null && 'onValueChange' in node.props,
    );

    act(() => {
      toggle.props.onValueChange(true);
    });

    expect(hasText(renderer!, 'How did you go from Girona to Barcelona?')).toBe(true);
    expect(findAllPressablesByText(renderer!, '🚶 Walking').length).toBeGreaterThanOrEqual(2);
    expect(findAllPressablesByText(renderer!, '🚲 Bicycle').length).toBeGreaterThanOrEqual(2);
    expect(findAllPressablesByText(renderer!, '🏍️ Motorcycle').length).toBeGreaterThanOrEqual(2);

    const returnMotorcyclePressables = findAllPressablesByText(renderer!, '🏍️ Motorcycle');

    act(() => {
      findAllPressablesByText(renderer!, '🚲 Bicycle')[0]?.props.onPress();
      returnMotorcyclePressables[returnMotorcyclePressables.length - 1]?.props.onPress();
    });

    expect(renderer!.root.findByProps({ testID: 'leg-type' }).props.children).toBe('bicycle');
    expect(renderer!.root.findByProps({ testID: 'return-leg-type' }).props.children).toBe(
      'motorcycle',
    );
  });
});
