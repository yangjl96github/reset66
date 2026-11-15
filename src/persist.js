// Persistent storage request (StorageManager API). Asks the browser not to evict our data.
// Every path resolves to a status; nothing here throws.

export const PersistStatus = Object.freeze({
  PERSISTED: 'persisted',
  NOT_PERSISTED: 'notPersisted',
  UNSUPPORTED: 'unsupported',
});

function storageManager() {
  const storage = globalThis.navigator?.storage;
  return storage && typeof storage.persisted === 'function' && typeof storage.persist === 'function' ? storage : null;
}

/** Current status, without prompting or requesting. */
export async function getPersistStatus() {
  const storage = storageManager();
  if (!storage) return PersistStatus.UNSUPPORTED;
  try {
    return (await storage.persisted()) ? PersistStatus.PERSISTED : PersistStatus.NOT_PERSISTED;
  } catch {
    return PersistStatus.UNSUPPORTED;
  }
}

/** Request persistence unless it is already granted. */
export async function ensurePersistentStorage() {
  const storage = storageManager();
  if (!storage) return PersistStatus.UNSUPPORTED;
  try {
    if (await storage.persisted()) return PersistStatus.PERSISTED;
    return (await storage.persist()) ? PersistStatus.PERSISTED : PersistStatus.NOT_PERSISTED;
  } catch {
    return PersistStatus.UNSUPPORTED;
  }
}
