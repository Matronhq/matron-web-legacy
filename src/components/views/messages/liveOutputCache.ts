/*
Copyright 2026 Matron Contributors.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { logger } from "matrix-js-sdk/src/logger";

import { getIDBFactory } from "../../../utils/StorageAccess";

const DB_NAME = "matron-live-output-cache";
const STORE = "entries";
const DB_VERSION = 1;
const TTL_MS = 24 * 60 * 60 * 1000;

export type CachedStatus = "running" | "complete" | "denied" | "expired" | "error";

export interface CachedEntry {
    toolUseId: string;
    command: string;
    rawText: string;
    status: CachedStatus;
    exitCode: number | null;
    truncated: boolean;
    cachedAt: number;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
    if (dbPromise) return dbPromise;
    const factory = getIDBFactory();
    if (!factory) return Promise.reject(new Error("IndexedDB not available"));
    dbPromise = new Promise((resolve, reject) => {
        const req = factory.open(DB_NAME, DB_VERSION);
        req.onerror = (): void => reject(req.error ?? new Error("IndexedDB open failed"));
        req.onsuccess = (): void => resolve(req.result);
        req.onupgradeneeded = (): void => {
            const db = req.result;
            if (!db.objectStoreNames.contains(STORE)) {
                db.createObjectStore(STORE, { keyPath: "toolUseId" });
            }
        };
    });
    return dbPromise;
}

function run<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    return openDb().then(
        (db) =>
            new Promise<T>((resolve, reject) => {
                const txn = db.transaction([STORE], mode);
                const store = txn.objectStore(STORE);
                const req = fn(store);
                req.onerror = (): void => reject(req.error);
                req.onsuccess = (): void => resolve(req.result);
            }),
    );
}

export async function loadEntry(toolUseId: string): Promise<CachedEntry | null> {
    try {
        const entry = await run<CachedEntry | undefined>("readonly", (s) => s.get(toolUseId));
        if (!entry) return null;
        if (Date.now() - entry.cachedAt > TTL_MS) {
            void deleteEntry(toolUseId);
            return null;
        }
        return entry;
    } catch (e) {
        logger.warn("liveOutputCache: load failed", e);
        return null;
    }
}

export async function saveEntry(entry: CachedEntry): Promise<void> {
    try {
        await run("readwrite", (s) => s.put(entry));
    } catch (e) {
        logger.warn("liveOutputCache: save failed", e);
    }
}

export async function deleteEntry(toolUseId: string): Promise<void> {
    try {
        await run("readwrite", (s) => s.delete(toolUseId));
    } catch (e) {
        logger.warn("liveOutputCache: delete failed", e);
    }
}

// Remove entries older than TTL. Called opportunistically; failures are silent.
export async function gc(): Promise<void> {
    try {
        const db = await openDb();
        await new Promise<void>((resolve, reject) => {
            const txn = db.transaction([STORE], "readwrite");
            const store = txn.objectStore(STORE);
            const cutoff = Date.now() - TTL_MS;
            const req = store.openCursor();
            req.onerror = (): void => reject(req.error);
            req.onsuccess = (): void => {
                const cursor = req.result;
                if (!cursor) {
                    resolve();
                    return;
                }
                const value = cursor.value as CachedEntry | undefined;
                if (value && value.cachedAt < cutoff) cursor.delete();
                cursor.continue();
            };
        });
    } catch (e) {
        logger.warn("liveOutputCache: gc failed", e);
    }
}

// Hook for tests: drop the cached connection so the next call reopens with a fresh factory.
export function resetForTesting(): void {
    dbPromise = null;
}
