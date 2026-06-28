import assert from 'node:assert/strict';
import test from 'node:test';

import { createArtworksService } from '../../../src/domains/artworks/service.js';
import type { ArtworksRepository } from '../../../src/domains/artworks/repository.js';
import { AppError } from '../../../src/shared/api/errors.js';

function createArtworksRepositoryStub(
  overrides: Partial<ArtworksRepository> = {},
): ArtworksRepository {
  return {
    async createArtworkLike() {
      throw new Error('not used');
    },
    async deleteArtworkLike() {
      throw new Error('not used');
    },
    async findArtworkDetail() {
      throw new Error('not used');
    },
    async findArtworkExists() {
      return true;
    },
    async listArtworkFilters() {
      throw new Error('not used');
    },
    async listArtworkFiltersV2() {
      throw new Error('not used');
    },
    async listArtworks() {
      throw new Error('not used');
    },
    async listHomeArtworkCards() {
      throw new Error('not used');
    },
    ...overrides,
  };
}

// 작품이 없으면 likeArtwork는 NOT_FOUND 에러를 던져야 한다.
test('artworks service throws NOT_FOUND when liking a missing artwork', async () => {
  const repository = createArtworksRepositoryStub({
    async findArtworkExists() {
      return false;
    },
  });
  const service = createArtworksService({
    artworksRepository: repository,
  });

  await assert.rejects(
    () => service.likeArtwork(99, 7),
    (error: unknown) => error instanceof AppError && error.code === 'NOT_FOUND',
  );
});

// 이미 좋아요가 있는 상태여도 likeArtwork는 최종 liked=true로 성공해야 한다.
test('artworks service keeps like requests idempotent', async () => {
  const calls: Array<{ args: number[]; step: string }> = [];
  const repository = createArtworksRepositoryStub({
    async createArtworkLike(userId, artworkId) {
      calls.push({
        args: [userId, artworkId],
        step: 'create',
      });
    },
    async findArtworkExists(artworkId) {
      calls.push({
        args: [artworkId],
        step: 'exists',
      });
      return true;
    },
  });
  const service = createArtworksService({
    artworksRepository: repository,
  });

  const result = await service.likeArtwork(12, 3);

  assert.deepEqual(result, {
    artworkId: 12,
    liked: true,
  });
  assert.deepEqual(calls, [
    {
      args: [12],
      step: 'exists',
    },
    {
      args: [3, 12],
      step: 'create',
    },
  ]);
});

// 좋아요가 없어도 unlikeArtwork는 최종 liked=false로 성공해야 한다.
test('artworks service keeps unlike requests idempotent', async () => {
  const calls: Array<{ args: number[]; step: string }> = [];
  const repository = createArtworksRepositoryStub({
    async deleteArtworkLike(userId, artworkId) {
      calls.push({
        args: [userId, artworkId],
        step: 'delete',
      });
    },
    async findArtworkExists(artworkId) {
      calls.push({
        args: [artworkId],
        step: 'exists',
      });
      return true;
    },
  });
  const service = createArtworksService({
    artworksRepository: repository,
  });

  const result = await service.unlikeArtwork(12, 3);

  assert.deepEqual(result, {
    artworkId: 12,
    liked: false,
  });
  assert.deepEqual(calls, [
    {
      args: [12],
      step: 'exists',
    },
    {
      args: [3, 12],
      step: 'delete',
    },
  ]);
});
