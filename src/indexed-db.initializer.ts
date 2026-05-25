export class IndexedDBInitializer {
  constructor(
    private readonly dbName: string,
    private readonly version: number,
    private readonly storeDefinitions: { name: string; options?: IDBObjectStoreParameters }[]
  ) {}

  async initialize(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onupgradeneeded = () => {
        const db = request.result;

        for (const def of this.storeDefinitions) {
          if (!db.objectStoreNames.contains(def.name)) {
            db.createObjectStore(def.name, def.options ?? { keyPath: "id" });
          }
        }
      };

      request.onsuccess = () => {
        const db = request.result;

        for (const def of this.storeDefinitions) {
          if (!db.objectStoreNames.contains(def.name)) {
            reject(new Error(`Object store "${def.name}" not found in database "${this.dbName}"`));

            return;
          }
        }
        resolve(db);
      };

      request.onerror = () => reject(request.error);
    });
  }
}
