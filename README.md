# @schorts/indexed-db-dao

[![npm version](https://badge.fury.io/js/%40schorts%2Findexed-db-dao.svg)](https://badge.fury.io/js/%40schorts%2Findexed-db-dao)

This module provides a type‑safe, domain‑driven abstraction over `IndexedDB` persistence. It integrates tightly with the `Model`, `Entity`, `Criteria`, and `UnitOfWork` constructs from [`@schorts/shared-kernel`](https://www.npmjs.com/package/@schorts/shared-kernel), enabling expressive, consistent, and testable offline data access.

## Installation

This package has a peer dependency on [`@schorts/shared-kernel`](https://www.npmjs.com/package/@schorts/shared-kernel).

```bash
npm install @schorts/indexeddb-dao @schorts/shared-kernel
```

## Usage

Here’s a complete example of how to use the IndexedDBDAO to interact with an `IndexedDB` object store.

### 1. Define your Entity

Entities map between domain objects and plain primitives for persistence. They must implement `toPrimitives()` and a static `fromPrimitives()`.

```ts
import { Entity as BaseEntity, Model as BaseModel, UUIDValue, EntityRegistry } from "@schorts/shared-kernel";

interface MyEntityModel extends BaseModel {
  name: string;
  aNumber: number;
}

class MyEntity extends BaseEntity<UUIDValue, MyEntityModel> {
  constructor(
    id: UUIDValue,
    public readonly name: string,
    public readonly aNumber: number,
  ) {
    super(id);
  }

  toPrimitives(): MyEntityModel {
    return {
      id: this.id.value,
      name: this.name,
      aNumber: this.aNumber,
    };
  }

  static fromPrimitives<Model extends BaseModel>(model: Model): MyEntity {
    return new MyEntity(
      new UUIDValue(model.id),
      model.name,
      model.aNumber,
    );
  }
}

// Register the entity with a store name
EntityRegistry.register("my-entities", MyEntity);
```

### 2. Create a concrete DAO class

`IndexedDBDAO` is abstract. Extend it for your entity and pass the database name and store name to the constructor.

```ts
import { IndexedDBDAO } from "@schorts/indexed-db-dao";

class MyEntityDAO extends IndexedDBDAO<MyEntityModel, MyEntity> {
  constructor() {
    super("MyDatabase", "my-entities");
  }
}
```

### 3. Use the DAO for CRUD and Criteria

The DAO supports full CRUD plus `Criteria` queries for filtering, ordering, limits, and offsets.

```ts
import { Criteria, Operator, Direction, UUIDValue } from "@schorts/shared-kernel";
import { v4 } from "uuid";

async function main() {
  const dao = new MyEntityDAO();

  // Create
  const entityId = new UUIDValue(v4());
  const entity = new MyEntity(entityId, "My Offline Entity", 42);
  await dao.create(entity);

  // Query with Criteria
  const criteria = new Criteria()
    .where("name", Operator.EQUAL, "My Offline Entity")
    .orderBy("aNumber", Direction.DESC)
    .limitResults(1);

  const found = await dao.findOneBy(criteria);
  console.log("Found:", found?.toPrimitives());

  // Update
  if (found) {
    const updated = new MyEntity(found.id, "Updated Offline Entity", 100);
    await dao.update(updated);
  }

  // Delete
  if (found) {
    await dao.delete(found);
  }
}

main();
```

### 4. Unit of Work

You can group multiple DAO operations into a single transaction using `IndexedDBUnitOfWork` and a `UnitOfWorkRunner`.

```ts
import { IndexedDBUnitOfWorkRunner } from "@schorts/indexeddb-dao";

const runner = new IndexedDBUnitOfWorkRunner("MyDatabase", ["my-entities"]);

await runner.run(async (uow) => {
  await dao.create(new MyEntity(new UUIDValue(v4()), "Batch Entity", 1), uow);
  await dao.create(new MyEntity(new UUIDValue(v4()), "Batch Entity 2", 2), uow);
  // Both succeed or rollback together
});
```

## Contributing

Contributions are welcome! Please feel free to submit a pull request or open an issue.

## License

This project is licensed under the LGPL‑3.0‑or‑later License.
