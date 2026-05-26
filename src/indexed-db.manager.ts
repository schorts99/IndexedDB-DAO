export class IndexedDBManager {
  static close(dbName: string) {
    const channel = new BroadcastChannel(dbName);

    channel.postMessage({ action: "close-db" });
  }

  static delete(dbName: string): Promise<void> {
    const request = indexedDB.deleteDatabase(dbName);

    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve();
      request.onerror = () => reject();
      request.onblocked = () => reject();
    });
  }
}
