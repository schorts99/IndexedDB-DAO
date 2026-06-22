import {
  OfflineStore,
  OfflinePayload,
  PascalCamelToSnake,
  SnakeToCamel,
} from "@schorts/shared-kernel";

export class IndexedDBOfflineStore<T = OfflinePayload> implements OfflineStore<T> {
  constructor(
    private readonly db: Promise<IDBDatabase>,
    private readonly storeName: string,
  ) {}

  async enqueue(key: string, payload: T): Promise<void> {
    const tx = (await this.db).transaction(this.storeName, "readwrite");
    let formattedPayload = payload;
    
    if (payload && typeof payload === "object") {
      if ("meta" in payload) {
        formattedPayload = PascalCamelToSnake.formatObject(formattedPayload);
      }
    }

    tx.objectStore(this.storeName).put({ key, payload: formattedPayload });
  }

  async list(): Promise<Array<{ key: string; payload: T }>> {
    return new Promise(async (resolve, reject) => {
      const tx = (await this.db).transaction(this.storeName, "readonly");
      const request = tx.objectStore(this.storeName).getAll();
      request.onsuccess = () => {
        const formattedResult = request.result.map((item: { key: string; payload: T }) => {
          let formattedPayload = item.payload;

          if (item.payload && typeof item.payload === "object") {
            if ("meta" in item.payload) {
              formattedPayload = SnakeToCamel.formatObject(item.payload);
            }
          }

          return {
            key: item.key,
            payload: formattedPayload,
          };
        });

        resolve(formattedResult);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async dequeue(key: string): Promise<void> {
    const tx = (await this.db).transaction(this.storeName, "readwrite");

    tx.objectStore(this.storeName).delete(key);
  }

  async clear(): Promise<void> {
    const tx = (await this.db).transaction(this.storeName, "readwrite");

    tx.objectStore(this.storeName).clear();
  }
}
