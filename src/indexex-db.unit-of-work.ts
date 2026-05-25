import { UnitOfWork } from "@schorts/shared-kernel";

import { TransactionNotActive, TransactionRollback } from "./exceptions";

export class IndexedDBUnitOfWork implements UnitOfWork {
  private tx: IDBTransaction | undefined;
  private active = false;

  constructor(
    private readonly db: IDBDatabase,
    private readonly storeNames: string[],
    private readonly mode: IDBTransactionMode = "readwrite"
  ) {}

  isActive(): boolean {
    return this.active;
  }

  async begin(): Promise<void> {
    this.tx = this.db.transaction(this.storeNames, this.mode);
    this.active = true;
  }

  async commit(): Promise<void> {
    if (!this.isActive) {
      throw new TransactionNotActive();
    }

    return new Promise((resolve, reject) => {
      this.tx!.oncomplete = () => {
        this.active = false;
        resolve();
      };
      this.tx!.onerror = () => {
        this.active = false;
        reject(this.tx!.error);
      };
      this.tx!.onabort = () => {
        this.active = false;
        reject(new TransactionRollback());
      };
    });
  }

  async rollback(): Promise<void> {
    if (!this.isActive) {
      throw new TransactionNotActive();
    }

    this.tx!.abort();
  }

  getStore(storeName: string): IDBObjectStore {
    if (!this.isActive) {
      throw new TransactionNotActive();
    }

    return this.tx!.objectStore(storeName);
  }
}
