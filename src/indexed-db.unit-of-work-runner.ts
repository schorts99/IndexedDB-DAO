import { UnitOfWorkRunner } from "@schorts/shared-kernel";

import { IndexedDBUnitOfWork } from "./indexex-db.unit-of-work";
import { DBNotReady } from "./exceptions";

export class IndexedDBUnitOfWorkRunner implements UnitOfWorkRunner {
  private readonly dbPromise: Promise<IDBDatabase>;
  private readonly storeNames: string[];

  constructor(
    dbPromise: Promise<IDBDatabase>,
    storeNames: string[],
  ) {
    this.dbPromise = dbPromise;
    this.storeNames = storeNames;
  }

  async run<Result>(
    operation: (uow: IndexedDBUnitOfWork) => Promise<Result>,
  ): Promise<Result> {
    const uow = this.createUnitOfWork();
    await uow.begin();

    try {
      const result = await operation(uow);

      await uow.commit();

      return result;
    } catch (error) {
      await uow.rollback();

      throw error;
    }
  }

  protected createUnitOfWork(): IndexedDBUnitOfWork {
    return new IndexedDBUnitOfWork(
      (this.dbPromise as any)._value ?? (() => { throw new DBNotReady() })(),
      this.storeNames,
      "readwrite",
    );
  }
}
