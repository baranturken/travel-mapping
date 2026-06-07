import type { ImagePickerAsset, ImagePickerResult } from 'expo-image-picker';

import type { CreateTripFormValues } from '@/features/trips/schemas';

type MemoryFormValue = CreateTripFormValues['stops'][number]['memories'][number];
type CreateMemory = (asset: ImagePickerAsset) => Promise<MemoryFormValue>;

export async function createMemoriesFromPickerResult(
  result: ImagePickerResult,
  createMemory: CreateMemory,
) {
  if (result.canceled || result.assets.length === 0) {
    return [];
  }

  return Promise.all(result.assets.map((asset) => createMemory(asset)));
}
