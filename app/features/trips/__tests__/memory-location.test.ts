import type { ImagePickerAsset } from 'expo-image-picker';

import { createMemoryFromAsset } from '@/features/trips/memory-location';

jest.mock('expo-file-system', () => {
  class MockDirectory {
    uri: string;
    exists = true;

    constructor(base: string, name: string) {
      this.uri = `${base}\\${name}`;
    }

    create() {}
  }

  class MockFile {
    uri: string;
    extension: string;
    exists = true;

    constructor(base: string | { uri: string }, name?: string) {
      const parentUri = typeof base === 'string' ? base : base.uri;
      this.uri = name ? `${parentUri}\\${name}` : parentUri;
      const extensionIndex = this.uri.lastIndexOf('.');
      this.extension = extensionIndex >= 0 ? this.uri.slice(extensionIndex) : '';
    }

    copy() {}
    delete() {}
  }

  return {
    Directory: MockDirectory,
    File: MockFile,
    Paths: {
      document: 'document',
    },
  };
});

describe('createMemoryFromAsset', () => {
  it('starts new memories with an empty caption instead of the file name', async () => {
    const memory = await createMemoryFromAsset({
      uri: 'file://istanbul-sunset.jpg',
      fileName: 'IMG_903884882.jpg',
      exif: null,
    } as ImagePickerAsset);

    expect(memory.caption).toBe('');
    expect(memory.imageUri).toContain('travel-memories');
  });
});
