import {
  Model,
  Entity as BaseEntity,
  ValueObject,
  DAO,
  DeleteMode,
  Criteria,
  EntityRegistry,
} from "@schorts/shared-kernel";

import { IndexedDBUnitOfWork } from "./indexex-db.unit-of-work";
import { IndexedDBCriteriaQueryExecutor } from "./indexed-db.criteria-query-executor";
import { DBNotInitialized } from "./exceptions";

export class IndexedDBDAO<
  M extends Model,
  Entity extends BaseEntity<ValueObject, M>
> extends DAO<M, Entity> {
  private dbPromise: Promise<IDBDatabase>;
  private channel: BroadcastChannel;

  constructor(
    dbName: string,
    private readonly storeName: string,
    deleteMode: DeleteMode = "HARD"
  ) {
    super(deleteMode);

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

  private async rawGetAll(): Promise<M[]> {
    const db = await this.dbPromise;

    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, "readonly");
      const store = tx.objectStore(this.storeName);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getAll(uow?: IndexedDBUnitOfWork): Promise<Entity[]> {
    if (uow) {
      return new Promise((resolve, reject) => {
        const store = uow.getStore(this.storeName);
        const request = store.getAll();
        request.onsuccess = () => {
          const entities = request.result.map((model: M) => 
            EntityRegistry.fromPrimitives(
              this.storeName,
              model,
            ),
          );

          resolve(entities);
        };
        request.onerror = () => reject(request.error);
      });
    }

    const entities = (await this.rawGetAll()).map((model: M) => 
      EntityRegistry.fromPrimitives(
        this.storeName,
        model,
      ),
    );

    return entities;
  }

  async findByID(id: Entity["id"]["value"], uow?: IndexedDBUnitOfWork): Promise<Entity | null> {
    const db = uow ? null : await this.dbPromise;

    return new Promise((resolve, reject) => {
      const store = uow
        ? uow.getStore(this.storeName)
        : db!.transaction(this.storeName, "readonly").objectStore(this.storeName);
      const request = store.get(id as any);
      request.onsuccess = () => {
        if (request.result) {
          const entity = EntityRegistry.fromPrimitives(
            this.storeName,
            request.result,
          );

          resolve(entity);
        } else {
          resolve(null);
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  async create(entity: Entity, uow?: IndexedDBUnitOfWork): Promise<Entity> {
    const store = uow
      ? uow.getStore(this.storeName)
      : (await this.dbPromise).transaction(this.storeName, "readwrite").objectStore(this.storeName);

    store.add(entity.toPrimitives());

    return entity;
  }

  async update(entity: Entity, uow?: IndexedDBUnitOfWork): Promise<Entity> {
    const store = uow
      ? uow.getStore(this.storeName)
      : (await this.dbPromise).transaction(this.storeName, "readwrite").objectStore(this.storeName);

    store.put(entity.toPrimitives());

    return entity;
  }

  async save(entity: Entity, uow?: IndexedDBUnitOfWork): Promise<Entity> {
    return this.update(entity, uow);
  }

  async delete(entity: Entity, uow?: IndexedDBUnitOfWork): Promise<Entity> {
    if (this.deleteMode === "SOFT") {
      (entity as any).deleted = true;

      await this.update(entity, uow);
    } else {
      await this.deleteByID(entity.id.value, uow);
    }

    return entity;
  }

  async deleteByID(id: Entity["id"]["value"], uow?: IndexedDBUnitOfWork): Promise<void> {
    const store = uow
      ? uow.getStore(this.storeName)
      : (await this.dbPromise).transaction(this.storeName, "readwrite").objectStore(this.storeName);

    store.delete(id as any);
  }

  async saveMany(entities: Entity[], uow?: IndexedDBUnitOfWork): Promise<Entity[]> {
    const store = uow
      ? uow.getStore(this.storeName)
      : (await this.dbPromise).transaction(this.storeName, "readwrite").objectStore(this.storeName);

    for (const e of entities) {
      store.put(e.toPrimitives());
    }

    return entities;
  }

  async restore(entity: Entity, uow?: IndexedDBUnitOfWork): Promise<Entity> {
    (entity as any).deleted = false;

    await this.update(entity, uow);

    return entity;
  }

  async search(criteria: Criteria, uow?: IndexedDBUnitOfWork): Promise<Entity[]> {
    const all = await this.getAll(uow);
    const filtered = IndexedDBCriteriaQueryExecutor.execute<Entity>(all, criteria);

    return filtered;
  }

  async findOneBy(criteria: Criteria, uow?: IndexedDBUnitOfWork): Promise<Entity | null> {
    const all = await this.getAll(uow);
    const filtered = IndexedDBCriteriaQueryExecutor.execute<Entity>(all, criteria);

    return filtered[0] ?? null;
  }

  async countBy(criteria: Criteria, uow?: IndexedDBUnitOfWork): Promise<number> {
    const all = await this.getAll(uow);

    return IndexedDBCriteriaQueryExecutor.execute<Entity>(all, criteria).length;
  }

  async exists(criteria: Criteria, uow?: IndexedDBUnitOfWork): Promise<boolean> {
    const all = await this.getAll(uow);

    return IndexedDBCriteriaQueryExecutor.execute<Entity>(all, criteria).length > 0;
  }
}
