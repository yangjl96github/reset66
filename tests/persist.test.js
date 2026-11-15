import { describe, it, expect, afterEach, vi } from 'vitest';
import { PersistStatus, ensurePersistentStorage, getPersistStatus } from '../src/persist.js';

function stubStorage({ persisted = false, grant = false, throws = false } = {}) {
  const calls = { persist: 0 };
  const storage = {
    persisted: vi.fn(async () => {
      if (throws) throw new Error('boom');
      return persisted;
    }),
    persist: vi.fn(async () => {
      calls.persist++;
      return grant;
    }),
  };
  vi.stubGlobal('navigator', { storage });
  return calls;
}

afterEach(() => vi.unstubAllGlobals());

describe('getPersistStatus', () => {
  it('reports unsupported when the Storage API is missing', async () => {
    vi.stubGlobal('navigator', {});
    expect(await getPersistStatus()).toBe(PersistStatus.UNSUPPORTED);
  });

  it('reports the current state without requesting', async () => {
    const calls = stubStorage({ persisted: true });
    expect(await getPersistStatus()).toBe(PersistStatus.PERSISTED);
    expect(calls.persist).toBe(0);
  });

  it('treats errors as unsupported', async () => {
    stubStorage({ throws: true });
    expect(await getPersistStatus()).toBe(PersistStatus.UNSUPPORTED);
  });
});

describe('ensurePersistentStorage', () => {
  it('skips the request when already persisted', async () => {
    const calls = stubStorage({ persisted: true });
    expect(await ensurePersistentStorage()).toBe(PersistStatus.PERSISTED);
    expect(calls.persist).toBe(0);
  });

  it('requests persistence and reports a grant', async () => {
    const calls = stubStorage({ persisted: false, grant: true });
    expect(await ensurePersistentStorage()).toBe(PersistStatus.PERSISTED);
    expect(calls.persist).toBe(1);
  });

  it('reports a refusal as not persisted', async () => {
    stubStorage({ persisted: false, grant: false });
    expect(await ensurePersistentStorage()).toBe(PersistStatus.NOT_PERSISTED);
  });

  it('never throws on unsupported browsers', async () => {
    vi.stubGlobal('navigator', { storage: {} });
    expect(await ensurePersistentStorage()).toBe(PersistStatus.UNSUPPORTED);
  });
});
