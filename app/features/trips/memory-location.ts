import { Directory, File, Paths } from 'expo-file-system';
import type { ImagePickerAsset } from 'expo-image-picker';

import type { CreateTripFormValues } from '@/features/trips/schemas';

type MemoryFormValue = CreateTripFormValues['stops'][number]['memories'][number];

type RationalLike = {
  numerator?: number;
  denominator?: number;
};

const memoryDirectory = new Directory(Paths.document, 'travel-memories');
const memoryDirectoryUri = memoryDirectory.uri;

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();

    if (!trimmed) {
      return null;
    }

    if (trimmed.includes('/')) {
      const [numerator, denominator] = trimmed.split('/');
      const left = Number(numerator);
      const right = Number(denominator);

      if (Number.isFinite(left) && Number.isFinite(right) && right !== 0) {
        return left / right;
      }
    }

    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }

  if (typeof value === 'object' && value) {
    const rational = value as RationalLike;

    if (
      typeof rational.numerator === 'number' &&
      typeof rational.denominator === 'number' &&
      rational.denominator !== 0
    ) {
      return rational.numerator / rational.denominator;
    }
  }

  return null;
}

function toCoordinate(value: unknown) {
  if (Array.isArray(value)) {
    const parts = value.map(toNumber).filter((part): part is number => part !== null);

    if (parts.length === 0) {
      return null;
    }

    if (parts.length === 1) {
      return parts[0];
    }

    const [degrees, minutes = 0, seconds = 0] = parts;
    return degrees + minutes / 60 + seconds / 3600;
  }

  return toNumber(value);
}

function applyHemisphere(value: number | null, reference: unknown) {
  if (value === null) {
    return null;
  }

  if (typeof reference !== 'string') {
    return value;
  }

  const upper = reference.trim().toUpperCase();
  return upper === 'S' || upper === 'W' ? -Math.abs(value) : Math.abs(value);
}

function extractCoordinates(exif?: Record<string, unknown> | null) {
  if (!exif) {
    return {
      latitude: null,
      longitude: null,
    };
  }

  const latitude =
    applyHemisphere(
      toCoordinate(exif.GPSLatitude ?? exif.latitude ?? exif.lat),
      exif.GPSLatitudeRef,
    ) ?? null;
  const longitude =
    applyHemisphere(
      toCoordinate(exif.GPSLongitude ?? exif.longitude ?? exif.lng ?? exif.lon),
      exif.GPSLongitudeRef,
    ) ?? null;

  return {
    latitude,
    longitude,
  };
}

function getPreferredExtension(asset: ImagePickerAsset) {
  const sourceFile = new File(asset.uri);

  if (sourceFile.extension) {
    return sourceFile.extension;
  }

  if (asset.fileName?.includes('.')) {
    return asset.fileName.slice(asset.fileName.lastIndexOf('.'));
  }

  return '.jpg';
}

function persistAssetUri(asset: ImagePickerAsset) {
  if (!memoryDirectory.exists) {
    memoryDirectory.create({ idempotent: true, intermediates: true });
  }

  const sourceFile = new File(asset.uri);
  const extension = getPreferredExtension(asset);
  const destinationFile = new File(
    memoryDirectory,
    `memory-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}${extension}`,
  );

  sourceFile.copy(destinationFile);
  return destinationFile.uri;
}

export function isManagedMemoryUri(uri: string) {
  const trimmedUri = uri.trim();
  return Boolean(trimmedUri) && trimmedUri.startsWith(memoryDirectoryUri);
}

export function deleteManagedMemoryUris(uris: readonly string[]) {
  const uniqueUris = Array.from(
    new Set(uris.map((uri) => uri.trim()).filter((uri) => isManagedMemoryUri(uri))),
  );

  for (const uri of uniqueUris) {
    const file = new File(uri);

    if (!file.exists) {
      continue;
    }

    file.delete();
  }
}

export async function createMemoryFromAsset(asset: ImagePickerAsset): Promise<MemoryFormValue> {
  const { latitude, longitude } = extractCoordinates(asset.exif);
  const persistedUri = persistAssetUri(asset);

  return {
    imageUri: persistedUri,
    caption: asset.fileName ?? '',
    latitude,
    longitude,
  };
}
