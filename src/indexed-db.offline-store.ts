import { OfflineStore, OfflinePayload } from "@schorts/shared-kernel";

import { DBNotInitialized } from "./exceptions";

export class IndexedDBOfflineStore<T = OfflinePayload> implements OfflineStore<T> {
  private dbPromise: Promise<IDBDatabase>;
  private channel: BroadcastChannel;

  constructor(
    dbName: string,
    private readonly storeName: string,
  ) {
    this.dbPromise = this.openDB(dbName);
    this.channel = new BroadcastChannel(dbName);
    this.channel.onmessage = async (event) => {
      if (event.data?.action === "close-db") {
        this.dbPromise.then((db) => db.close());
      }
    };
  }

  private openDB(dbName: string): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(dbName, 1);
      request.onsuccess = () => {
        const db = request.result;

        if (!db.objectStoreNames.contains(this.storeName)) {
          reject(
            new DBNotInitialized(
              `Object store "${this.storeName}" not found in database "${dbName}". Did you run the initializer or bump the version?`
            )
          );

          return;
        }

        resolve(db);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async enqueue(key: string, payload: T): Promise<void> {
    const db = await this.dbPromise;
    const tx = db.transaction(this.storeName, "readwrite");

    tx.objectStore(this.storeName).put({ key, payload });
  }

  async list(): Promise<Array<{ key: string; payload: T }>> {
    const db = await this.dbPromise;

    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, "readonly");
      const request = tx.objectStore(this.storeName).getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async dequeue(key: string): Promise<void> {
    const db = await this.dbPromise;
    const tx = db.transaction(this.storeName, "readwrite");

    tx.objectStore(this.storeName).delete(key);
  }

  async clear(): Promise<void> {
    const db = await this.dbPromise;
    const tx = db.transaction(this.storeName, "readwrite");

    tx.objectStore(this.storeName).clear();
  }
}
