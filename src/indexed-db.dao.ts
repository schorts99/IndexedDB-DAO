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

export class IndexedDBDAO<
  M extends Model,
  Entity extends BaseEntity<ValueObject, M>
> extends DAO<M, Entity> {

  constructor(
    private readonly db: Promise<IDBDatabase>,
    private readonly storeName: string,
    deleteMode: DeleteMode = "HARD"
  ) {
    super(deleteMode);
  }

  private async rawGetAll(): Promise<M[]> {
    return new Promise(async (resolve, reject) => {
      const tx = (await this.db).transaction(this.storeName, "readonly");
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
    return new Promise(async (resolve, reject) => {
      const store = uow
        ? uow.getStore(this.storeName)
        : (await this.db).transaction(this.storeName, "readonly").objectStore(this.storeName);
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
      : (await this.db).transaction(this.storeName, "readwrite").objectStore(this.storeName);

    store.add(entity.toPrimitives());

    return entity;
  }

  async update(entity: Entity, uow?: IndexedDBUnitOfWork): Promise<Entity> {
    const store = uow
      ? uow.getStore(this.storeName)
      : (await this.db).transaction(this.storeName, "readwrite").objectStore(this.storeName);

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
      : (await this.db).transaction(this.storeName, "readwrite").objectStore(this.storeName);

    store.delete(id as any);
  }

  async saveMany(entities: Entity[], uow?: IndexedDBUnitOfWork): Promise<Entity[]> {
    const store = uow
      ? uow.getStore(this.storeName)
      : (await this.db).transaction(this.storeName, "readwrite").objectStore(this.storeName);

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
