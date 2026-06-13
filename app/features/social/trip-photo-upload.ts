import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';

import { supabase } from '@/lib/supabase';
import type { TripPhoto } from './types';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
const BUCKET = 'trip-photos';
const MAX_PHOTOS = 24;

export type LocalPhoto = {
  id: string;
  imageUri: string;
  caption: string | null;
  cityName: string | null;
};

// Uploads a trip's local memory photos to the public storage bucket and returns
// their public URLs. Paths are deterministic ({userId}/{tripId}/{photoId}.jpg)
// with x-upsert, so re-publishing overwrites in place rather than duplicating.
export async function uploadTripPhotos(
  userId: string,
  localTripId: string,
  photos: LocalPhoto[],
): Promise<TripPhoto[]> {
  if (photos.length === 0) return [];

  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error('You must be signed in to publish photos.');

  const selected = photos.slice(0, MAX_PHOTOS);
  const results: TripPhoto[] = [];

  for (const photo of selected) {
    try {
      const { uri: jpegUri } = await ImageManipulator.manipulateAsync(
        photo.imageUri,
        [{ resize: { width: 1280 } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG },
      );
      const path = `${userId}/${localTripId}/${photo.id}.jpg`;
      const uploadUrl = `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`;
      const res = await FileSystem.uploadAsync(uploadUrl, jpegUri, {
        httpMethod: 'POST',
        uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: SUPABASE_ANON_KEY,
          'Content-Type': 'image/jpeg',
          'x-upsert': 'true',
        },
      });
      if (res.status !== 200 && res.status !== 201) continue;
      results.push({
        url: `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`,
        caption: photo.caption,
        cityName: photo.cityName,
      });
    } catch {
      // Skip individual photos that fail to process or upload.
    }
  }

  return results;
}

export async function deleteTripPhotos(userId: string, localTripId: string): Promise<void> {
  const prefix = `${userId}/${localTripId}`;
  const { data } = await supabase.storage.from(BUCKET).list(prefix);
  if (data && data.length > 0) {
    await supabase.storage.from(BUCKET).remove(data.map((f) => `${prefix}/${f.name}`));
  }
}

// Uploads a square avatar image to the user's own folder and returns its public
// URL. A timestamped filename busts the CDN/image cache so the new avatar shows
// immediately after editing.
export async function uploadAvatar(userId: string, imageUri: string): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error('You must be signed in to update your avatar.');

  const { uri: jpegUri } = await ImageManipulator.manipulateAsync(
    imageUri,
    [{ resize: { width: 512 } }],
    { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG },
  );

  const path = `${userId}/avatar/${Date.now()}.jpg`;
  const uploadUrl = `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`;
  const res = await FileSystem.uploadAsync(uploadUrl, jpegUri, {
    httpMethod: 'POST',
    uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: SUPABASE_ANON_KEY,
      'Content-Type': 'image/jpeg',
      'x-upsert': 'true',
    },
  });
  if (res.status !== 200 && res.status !== 201) {
    throw new Error('Could not upload the avatar. Please try again.');
  }
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;
}

// Uploads a wide banner image to the user's own folder and returns its public
// URL. Timestamped filename busts the image cache.
export async function uploadBanner(userId: string, imageUri: string): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error('You must be signed in to update your banner.');

  const { uri: jpegUri } = await ImageManipulator.manipulateAsync(
    imageUri,
    [{ resize: { width: 1280 } }],
    { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG },
  );

  const path = `${userId}/banner/${Date.now()}.jpg`;
  const uploadUrl = `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`;
  const res = await FileSystem.uploadAsync(uploadUrl, jpegUri, {
    httpMethod: 'POST',
    uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: SUPABASE_ANON_KEY,
      'Content-Type': 'image/jpeg',
      'x-upsert': 'true',
    },
  });
  if (res.status !== 200 && res.status !== 201) {
    throw new Error('Could not upload the banner. Please try again.');
  }
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;
}

// Uploads a rendered story-cover JPEG (base64, no data: prefix) for a published
// trip and returns its public URL. Deterministic path → re-publishing overwrites.
export async function uploadStoryCover(
  userId: string,
  localTripId: string,
  base64Jpeg: string,
): Promise<string | null> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) return null;

    const tmpUri = `${FileSystem.cacheDirectory ?? ''}story-cover-${localTripId}.jpg`;
    await FileSystem.writeAsStringAsync(tmpUri, base64Jpeg, {
      encoding: FileSystem.EncodingType.Base64,
    });

    const path = `${userId}/${localTripId}/cover.jpg`;
    const uploadUrl = `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`;
    const res = await FileSystem.uploadAsync(uploadUrl, tmpUri, {
      httpMethod: 'POST',
      uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: SUPABASE_ANON_KEY,
        'Content-Type': 'image/jpeg',
        'x-upsert': 'true',
      },
    });
    if (res.status !== 200 && res.status !== 201) return null;
    // Cache-bust so an updated cover replaces the old one in image caches.
    return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}?v=${Date.now()}`;
  } catch {
    return null;
  }
}
