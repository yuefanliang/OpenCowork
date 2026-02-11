import type { RequestDebugInfo } from './api/types'

/**
 * Lightweight in-memory store for request debug info.
 * Only keeps the LAST request's debug info (keyed by message ID).
 * Not persisted, not in Zustand — avoids bloating chat store and DB.
 */
const _store = new Map<string, RequestDebugInfo>()

/** Set debug info for a message, clearing any previous entry to keep only one. */
export function setLastDebugInfo(msgId: string, info: RequestDebugInfo): void {
  _store.clear()
  _store.set(msgId, info)
}

/** Get debug info for a message (only available if it's the last recorded). */
export function getLastDebugInfo(msgId: string): RequestDebugInfo | undefined {
  return _store.get(msgId)
}
