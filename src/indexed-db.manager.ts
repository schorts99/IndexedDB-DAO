export class IndexedDBManager {
  static close(dbName: string): Promise<void> {
    return new Promise((resolve) => {
      const channel = new BroadcastChannel(dbName);

      channel.postMessage({ action: "close-db" });
      channel.onmessage = (event) => {
        if (event.data?.action === "db-closed") {
          channel.close();
          resolve();
        }
      };
    });
  }

  static delete(dbName: string): Promise<void> {
    const request = indexedDB.deleteDatabase(dbName);

    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve();
      request.onerror = () => reject();
      request.onblocked = () => reject(new Error("Deletion blocked"));
    });
  }
}
