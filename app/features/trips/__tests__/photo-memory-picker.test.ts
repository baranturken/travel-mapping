import type { ImagePickerAsset } from 'expo-image-picker';

import { createMemoriesFromPickerResult } from '@/features/trips/photo-memory-picker';

const assetA = { assetId: 'asset-a', uri: 'file://a.jpg' } as ImagePickerAsset;
const assetB = { assetId: 'asset-b', uri: 'file://b.jpg' } as ImagePickerAsset;

describe('createMemoriesFromPickerResult', () => {
  it('maps every selected asset when multi-selection returns multiple photos', async () => {
    const createMemory = jest
      .fn()
      .mockImplementation(async (asset: ImagePickerAsset) => ({ imageUri: asset.uri, caption: '', latitude: null, longitude: null }));

    const memories = await createMemoriesFromPickerResult(
      {
        canceled: false,
        assets: [assetA, assetB],
      },
      createMemory,
    );

    expect(createMemory).toHaveBeenCalledTimes(2);
    expect(memories.map((memory) => memory.imageUri)).toEqual(['file://a.jpg', 'file://b.jpg']);
  });

  it('returns no memories when the picker is canceled', async () => {
    const createMemory = jest.fn();

    const memories = await createMemoriesFromPickerResult(
      {
        canceled: true,
        assets: null,
      },
      createMemory,
    );

    expect(memories).toEqual([]);
    expect(createMemory).not.toHaveBeenCalled();
  });
});
