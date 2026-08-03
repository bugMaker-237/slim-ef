# Slim-EF

![logo](/slim-ef.png)

Slim-EF is an implementation of basic entity framework & LINQ functionalities in TypeScript, powered by the [slim-exp expression parser](https://github.com/bugMaker-237/slim-exp). Entity Framework makes life easier for .NET developers with the help of the powerful fluent LINQ API. Many Node.js ORMs exist out there. Unfortunately none of them offers a **completely string-literal-free fluent API**. Although this is normal for a .NET dev like me who will desire (and think that is a must) to work in such an environment.

## Package Architecture

The codebase is split into two published packages:

| Package                                | Description                                                                                                                                        |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`@slim-ef/core`](packages/core)       | Framework core — fluent LINQ query API, `DbContext`/`UnitOfWork`, `DbSet`, specifications, abstractions. **No direct TypeORM runtime dependency.** |
| [`@slim-ef/typeorm`](packages/typeorm) | TypeORM adapter — `TypeOrmConnectionAdapter`, `SQLQuerySpecificationEvaluator` and any other TypeORM-specific implementations.                     |

This split means you can use `@slim-ef/core` in a project that targets a different ORM by providing your own `IQuerySpecificationEvaluator`/`IDbConnectionAdapter` implementation, while keeping the same fluent LINQ API.

### Prerequisite

- A knowledge of [TypeORM](https://github.com/typeorm/typeorm).
  Although `@slim-ef/core` no longer depends on TypeORM at runtime, the default adapter (`@slim-ef/typeorm`) is built on top of TypeORM. You still need to define your models with TypeORM decorators (`@Column`, `@OneToMany`, etc.) or `EntitySchema`. Future versions may add adapters for other ORMs.

### Why you should use slim-ef

- **string-literal-free**: String literals are error prone. It's safer to call a function `.where((t, $) => t.name.includes($.name))` than writing a string literal `"entity.name like 'buggy'"`.
- **Refactoring becomes a pleasure**: Renaming a model attribute never breaks your queries, since they are expressed as typed lambdas instead of hardcoded strings.
- **Code readability**: You no longer need database-specific SQL knowledge, and the code reads itself.
- **Transition from .NET**: Transitioning from the .NET world is easier if you already know Entity Framework.

### Works/tested on

- SQLite (via `better-sqlite3`)
- MySQL / MariaDB
- PostgreSQL
- MSSQL

### Installing

```bash
# Framework core
npm i @slim-ef/core

# TypeORM adapter (required to use the default SQL evaluator with TypeORM)
npm i @slim-ef/typeorm typeorm
```

## How to use

### Setup

The design of this API resembles **Entity Framework** as closely as possible.
First define your models using TypeORM decorators or `EntitySchema`, as specified in the [TypeORM docs](https://github.com/typeorm/typeorm/blob/master/docs/entities.md).

Then create a `DbContext` class that inherits from slim-ef's `DbContext`:

```ts
import { resolve } from 'path';
import { TypeOrmConnectionAdapter } from '@slim-ef/typeorm';
import {
  DbContext,
  DbContextModelBuilder,
  DbSetEntity,
  IDbContextOptionsBuilder,
  IDbSet
} from '@slim-ef/core';
import { SQLQuerySpecificationEvaluator } from '@slim-ef/typeorm';
import { Agency, AgencySchema } from './entities/agency';
import { Person, PersonSchema } from './entities/person';
import { Trip, TripSchema } from './entities/trip';

export class FakeDBContext extends DbContext {
  constructor() {
    super(
      new TypeOrmConnectionAdapter({
        type: 'better-sqlite3',
        database: resolve(__dirname, 'seeder', 'slim_ef_test.db'),
        entities: [PersonSchema, AgencySchema, TripSchema],
        synchronize: false
      }),
      SQLQuerySpecificationEvaluator
    );
  }

  protected onModelCreation<BaseType extends object = any>(
    builder: DbContextModelBuilder<BaseType>
  ): void {
    // Global query filters are applied to every query on Person
    builder.entity(Person).hasQueryFilter(q => q.where(e => e.IDNumber > 50));
  }

  protected onConfiguring(optionsBuilder: IDbContextOptionsBuilder): void {
    optionsBuilder.useLoggerFactory({
      createLogger: (catName: string) => ({
        log: (level, state) => console.log({ catName, state, level })
      })
    });
  }

  @DbSetEntity(Person)
  public readonly persons!: IDbSet<Person, Person>;

  @DbSetEntity(Agency)
  public readonly agencies!: IDbSet<Agency, Agency>;

  @DbSetEntity(Trip)
  public readonly trips!: IDbSet<Trip, Trip>;
}
```

The `FakeDbContext` class represents your data store. Each property marked with `@DbSetEntity` is a data set (a collection of its specific type).

> **Note:** `TypeOrmConnectionAdapter` wraps TypeORM's `DataSource`. The old codebase accepted a TypeORM `Connection`/`DataSource` directly because TypeORM's `Connection` is structurally compatible with the new `IDbConnectionAdapter` interface — you can still pass a raw connection if you prefer.

## Available APIs

### `IDbContext` / `DbContext`

| Method                          | Description                                                                                                 |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `add<T>(...entities)`           | Begins tracking the given entities in the `Added` state so they are inserted on the next `saveChanges()`.   |
| `update<T>(...entities)`        | Begins tracking the given entities in the `Modified` state so they are updated on the next `saveChanges()`. |
| `remove<T>(...entities)`        | Begins tracking the given entities in the `Deleted` state so they are removed on the next `saveChanges()`.  |
| `unTrack<T>(...entities)`       | Removes the entities from all tracking lists (added/modified/deleted).                                      |
| `find<T>(type, id)`             | Finds an entity by primary key, or `undefined`/`null` when not found.                                       |
| `query(query, parameters)`      | Opens a connection and executes a raw SQL query.                                                            |
| `rollback(entityType?)`         | Discards all tracked changes of the given type (or of every type when omitted).                             |
| `set<T>(type)`                  | Creates an ad-hoc `IDbSet<T>` for a given entity type.                                                      |
| `saveChanges()`                 | Saves all tracked changes to the database, returning `{ added, updated, deleted }`.                         |
| `openTransaction()`             | Starts a new user transaction.                                                                              |
| `commitTransaction()`           | Commits the current user transaction.                                                                       |
| `rollbackTransaction()`         | Rolls back the current user transaction.                                                                    |
| `transactionIsOpen()`           | Whether a user transaction is currently open.                                                               |
| `loadRelatedData(type, entity)` | Reloads an entity (with its data) from the store.                                                           |
| `dispose()`                     | Releases allocated resources and closes the connection.                                                     |

### `IDbSet<T>` / `IQueryable<T>`

| Method                                                 | Description                                                                        |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| `add / update / remove / unTrack`                      | Same tracking operations as `DbContext`, scoped to this set's type.                |
| `find(id)`                                             | Finds an entity by primary key.                                                    |
| `exists(id)`                                           | Whether an entity with the given id exists.                                        |
| `first()` / `first(predicate, ctx?)`                   | Returns the first element, throwing when the sequence is empty.                    |
| `firstOrDefault()` / `firstOrDefault(predicate, ctx?)` | Returns the first element or `undefined` when the sequence is empty.               |
| `toList()`                                             | Materializes the query into an array.                                              |
| `include(nav)`                                         | Specifies related entities to include in the query results.                        |
| `thenInclude(nav)`                                     | Chains an additional include onto the last `include`.                              |
| `where(predicate, ctx?)`                               | Filters the sequence. Supports an external context object via the second argument. |
| `take(count)`                                          | Limits the number of returned elements.                                            |
| `skip(count)`                                          | Bypasses the first N elements.                                                     |
| `orderBy(sel)`                                         | Sorts ascending by a key.                                                          |
| `orderByDescending(sel)`                               | Sorts descending by a key.                                                         |
| `thenOrderBy(sel)`                                     | Applies a secondary ascending ordering.                                            |
| `groupBy(sel)`                                         | Groups the results by a key.                                                       |
| `thenGroupBy(sel)`                                     | Applies a secondary grouping.                                                      |
| `select(proj)`                                         | Projects each element into a new shape (see "Select" below).                       |
| `count(predicate?, ctx?)`                              | Counts elements, optionally filtered.                                              |
| `sum(sel)`                                             | Sums a projected numeric key.                                                      |
| `average(sel)`                                         | Averages a projected numeric key.                                                  |
| `min(sel)` / `max(sel)`                                | Returns the minimum/maximum of a projected key.                                    |
| `distinct()`                                           | Removes duplicate rows from the query result.                                      |
| `ignoreQueryFilters()`                                 | Disables the model-level query filters for this query.                             |
| `asSpecification()`                                    | Returns the accumulated `ISpecification` for this query.                           |
| `fromSpecification(spec)`                              | Builds a query from a reusable specification object.                               |
| `loadRelatedData(entity)`                              | Reloads an entity from the store.                                                  |

### Select projections

`select` accepts any object or class constructor, including nested projections and array mapping:

```ts
const trips = await context.trips
  .include(t => t.agency)
  .include(t => t.passengers)
  .select(
    t =>
      new TripResponse(
        t.agency.name,
        t.agency.email!,
        t.departureDate,
        t.passengers.map(p => ({
          name: p.lastname,
          phone: p.phone,
          ID: p.IDNumber
        }))
      )
  )
  .toList();
```

Fields accessed in the selector that belong to a relation **must** be included via `.include(...)` / `.thenInclude(...)`, otherwise the proxy metadata cannot be built.

### Repository pattern (`EntityRepository` + `GenericRepository` + `UnitOfWork`)

For a unit-of-work/repository style, decorate repository classes and extend `GenericRepository`:

```ts
import {
  EntityRepository,
  GenericRepository,
  UnitOfWork,
  DbContextModelBuilder,
  IDbContextOptionsBuilder
} from '@slim-ef/core';
import {
  TypeOrmConnectionAdapter,
  SQLQuerySpecificationEvaluator
} from '@slim-ef/typeorm';

export class UOW extends UnitOfWork {
  constructor() {
    super(
      new TypeOrmConnectionAdapter({/* ... */}),
      SQLQuerySpecificationEvaluator
    );
  }
  protected onModelCreation(builder: DbContextModelBuilder) {
    builder.entity(Person).hasQueryFilter(q => q.where(e => e.IDNumber > 50));
  }
  protected onConfiguring(options: IDbContextOptionsBuilder) {}
}
export const uow = new UOW();

@EntityRepository(Person)
export class PersonRepository extends GenericRepository<Person> {
  constructor() {
    super(uow);
  }
}

// Usage
const repo = new PersonRepository();
repo.add(person);
await uow.saveChanges();
const found = await repo.find(person.id);
```

> Keep a **singleton** `UnitOfWork` so that repositories injected with it do not create multiple connections.

### Transactions

```ts
const context = new FakeDBContext();
await context.openTransaction();
context.persons.add(person);
const { added } = await context.saveChanges();
await context.rollbackTransaction(); // discards the insert
```

### Global query filters

Define filters in `onModelCreation`; they are applied to every query of that entity unless `ignoreQueryFilters()` is used:

```ts
builder.entity(Person).hasQueryFilter(q => q.where(e => e.IDNumber > 50));
```

## Implementing a custom adapter

The core exposes minimal abstractions that any ORM can implement:

| Interface                                                                 | Description                                                            |
| ------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `IDbConnectionAdapter`                                                    | Abstraction over a database connection provider.                       |
| `IDbRepository<T>`                                                        | Abstraction over a repository for a single entity type.                |
| `IQueryRunner`                                                            | Abstraction over a transaction runner.                                 |
| `IEntityManager`                                                          | Abstraction over the entity manager (preload support).                 |
| `IEntityMetadata` / `IEntityColumnMetadata` / `IEntityRelationMetadata`   | Minimal entity metadata shapes used by the proxy builder.              |
| `IQuerySpecificationEvaluator` / `QuerySpecificationEvaluatorConstructor` | Contract for translating an `ISpecification` into an executable query. |

Because TypeORM's `DataSource`, `Repository`, `QueryRunner` and `EntityManager` are structurally compatible with these interfaces, existing code can often be passed directly without wrappers.

## Samples

> Throughout these samples `context` is a `FakeDBContext` (see [Setup](#setup)) and the
> entities are `Person`, `Agency` and `Trip`. All queries against `Person` are subject to the
> global filter `IDNumber > 50` defined in `onModelCreation`.

### CRUD

```ts
// Add
const person = new Person();
person.firstname = 'Buggy';
person.lastname = 'Maker';
person.IDNumber = 800;
person.phone = '+237699977788';

context.persons.add(person);
const { added } = await context.saveChanges(); // added[0].id is now populated

// Add several entities at once (with related entities)
context.agencies.add(agency);
await context.saveChanges();
const t1 = new Trip();
t1.agency = agency;
context.trips.add(t1, t2);
const saved = await context.saveChanges();

// Update
let dbPerson = await context.persons.first();
context.persons.update({ ...dbPerson, firstname: 'Bug' });
await context.saveChanges();

// Remove
const toDelete = await context.persons.first();
context.remove(toDelete); // or context.persons.remove(toDelete)
await context.saveChanges();

// Stop tracking (the change will not be persisted)
context.persons.add(person);
context.persons.unTrack(person);
await context.saveChanges();

// Roll back all staged changes of a given type (or of every type)
context.persons.add(person);
context.rollback(Person); // removes person from the "added" queue
await context.saveChanges();
```

### Find & existence checks

```ts
const person = await context.persons.first();
const found = await context.persons.find(person.id);       // entity or undefined
const exists = await context.persons.exists(person.id);   // boolean

// Raw SQL query
const res = await context.query('SELECT COUNT(*) AS cnt FROM person', []);
console.log('count =', res[0].cnt);

// Ad-hoc set for any entity type
const persons = await context.set(Person).take(5).toList();

// Reload an entity (plus its data) from the store
const loaded = await context.persons.loadRelatedData(person);
```

### Querying (`toList`, `first`, `firstOrDefault`)

```ts
const all = await context.persons.toList();
const first = await context.persons.first(); // throws if empty
const buggy = await context.persons.first(p => p.firstname === 'Buggy');
const maybe = await context.persons.firstOrDefault(); // undefined if none
```

### Filtering (`where`)

```ts
// Comparisons & booleans
await context.persons.where(p => p.IDNumber > 500000).toList();
await context.persons.where(p => p.willTravel === true).toList();
await context.persons.where(p => !!p.willTravel).toList();          // double-exclamation
await context.persons.where(p => !p.willTravel).toList();           // negation
await context.persons.where(p => p.willTravel === false).toList();

// Logical operators
await context.persons
  .first(p => p.firstname === 'Buggy' && p.lastname === 'Maker');

// String functions
await context.persons.where(p => p.firstname.startsWith('Bugg')).toList();
await context.persons.where(p => p.lastname.endsWith('uggy')).toList();
await context.persons.where(p => p.firstname.includes('gg')).toList();

// Array functions on relations
await context.trips
  .include(t => t.passengers)
  .where(t => t.passengers.some(p => p.willTravel === true))
  .toList();

// External context object referenced through the `$` marker (no string literals)
const ctx = {
  departureDate: new Date(2000, 1, 1),
  estimatedArrivalDate: new Date(2016, 1, 1)
};
await context.trips
  .where(
    (t, $) =>
      t.departureDate > $.departureDate &&
      t.estimatedArrivalDate! < $.estimatedArrivalDate,
    ctx
  )
  .toList();
```

### Includes (`include`, `thenInclude`)

```ts
const persons = await context.persons
  .include(p => p.trip)
  .thenInclude(t => t.agency)
  .toList();

const trips = await context.trips
  .include(t => t.agency)
  .include(t => t.passengers)
  .toList();
```

### Projections (`select`)

```ts
// Anonymous object
const projections = await context.persons
  .include(p => p.trip)
  .thenInclude(t => t.agency)
  .select(p => ({
    departureDate: p.trip.departureDate,
    agencyName: p.trip.agency!.name
  }))
  .toList();

// Class/constructor + nested collection mapping
class TripResponse {
  constructor(
    public agencyName: string,
    public agencyEmail: string,
    public departureDate: Date,
    public passengers: { name: string; phone: string; ID: number }[]
  ) {}
}

const res = await context.trips
  .include(t => t.agency)
  .include(t => t.passengers)
  .select(t =>
    new TripResponse(
      t.agency.name,
      t.agency.email!,
      t.departureDate,
      t.passengers.map(p => ({
        name: p.lastname,
        phone: p.phone,
        ID: p.IDNumber
      }))
    )
  )
  .toList();
```

> Relation fields used inside the selector must be brought in via `.include()`/`.thenInclude()`.

### Ordering (`orderBy`, `orderByDescending`, `thenOrderBy`)

```ts
const asc = await context.persons.orderBy(p => p.IDNumber).toList();
const desc = await context.persons.orderByDescending(p => p.IDNumber).toList();
const secondary = await context.persons
  .orderBy(p => p.willTravel)
  .thenOrderBy(p => p.firstname)
  .toList();
```

### Paging (`take`, `skip`)

```ts
const page = await context.persons
  .orderBy(p => p.IDNumber)
  .skip(10)
  .take(10)
  .toList(); // elements 11..20
```

### Grouping (`groupBy`, `thenGroupBy`)

```ts
const grouped = await context.persons.groupBy(p => p.willTravel).toList();
const nested = await context.persons
  .groupBy(p => p.willTravel)
  .thenGroupBy(p => p.IDNumber)
  .toList();
```

### Aggregates (`count`, `sum`, `average`, `min`, `max`)

```ts
const count = await context.persons.count();
const countFiltered = await context.persons.count(p => p.IDNumber > 500000);
const sum = await context.persons.sum(p => p.IDNumber);
const avg = await context.persons.average(p => p.IDNumber);
const min = await context.persons.min(p => p.firstname);
const max = await context.persons.max(p => p.firstname);
```

### Distinct

```ts
const agencyIds = await context.trips
  .include(t => t.agency)
  .select(t => ({ aId: t.agencyId }))
  .distinct()
  .toList();
```

### Global query filters

```ts
// Defined in onModelCreation()
builder.entity(Person).hasQueryFilter(q => q.where(e => e.IDNumber > 50));

// The filter is applied to every Person query by default...
const filtered = await context.persons.firstOrDefault(p => p.IDNumber === 5); // undefined

// ...and can be bypassed for a single query
const ignored = await context.persons
  .ignoreQueryFilters()
  .firstOrDefault(p => p.IDNumber === 5); // found
```

### Transactions

```ts
await context.openTransaction();
context.persons.add(person);
await context.saveChanges();

await context.rollbackTransaction(); // insert discarded
// ...or await context.commitTransaction(); // insert committed
```

### Repository pattern

```ts
import { EntityRepository, GenericRepository, UnitOfWork } from '@slim-ef/core';
import { TypeOrmConnectionAdapter, SQLQuerySpecificationEvaluator } from '@slim-ef/typeorm';

export const uow = new (class UOW extends UnitOfWork {
  constructor() {
    super(
      new TypeOrmConnectionAdapter({ type: 'better-sqlite3', database: 'app.db' }),
      SQLQuerySpecificationEvaluator
    );
  }
  protected onModelCreation(b) {}
  protected onConfiguring(o) {}
})();

@EntityRepository(Person)
export class PersonRepository extends GenericRepository<Person> {
  constructor() {
    super(uow);
  }
}

const repo = new PersonRepository();
repo.add(person);
await uow.saveChanges();
const found = await repo.find(person.id);
const many = await repo.where(p => p.IDNumber > 500000).toList();
```

For detailed examples see: [Slim-ef-examples](https://github.com/BugMaker-237/slim-ef-examples)

## Not YET Supported

- The `select` API does not support operation evaluation, only direct assignment, i.e.

  ```ts
  .select(t => new TripResponse(
    t.agency.name,
    t.agency.email,
    t.departureDate,
    t.passengers.map(p => ({
      name: p.lastname + ' ' + p.firstName, // <- Not supported
      phone: p.phone,
      ID: p.IDNumber,
      anotherOne: p.lastname.includes('something'), // <- Not supported
      andAlso: p.IDNumber > 8520 // <- Not supported
    }))
  ))
  ```

- Change tracking (automatic `DetectChanges`) is not implemented; call `update(...)` explicitly.

## Usage Note

- Avoid unnecessary parentheses in expression functions.

## Migration Guide (monolith → package split)

### Breaking Changes

1. **Package names changed**
   - `slim-ef` → **`@slim-ef/core`**
   - `slim-ef-typeorm` → **`@slim-ef/typeorm`**

2. **`SQLQuerySpecificationEvaluator` has moved** from the core package to `@slim-ef/typeorm`.

#### Before (v0.9.x)

```ts
import { DbContext, SQLQuerySpecificationEvaluator } from 'slim-ef';
import { Connection } from 'typeorm';

export class MyContext extends DbContext {
  constructor() {
    super(new Connection({...}), SQLQuerySpecificationEvaluator);
  }
}
```

#### After (current)

```ts
import { DbContext } from '@slim-ef/core';
import { SQLQuerySpecificationEvaluator, TypeOrmConnectionAdapter } from '@slim-ef/typeorm';

export class MyContext extends DbContext {
  constructor() {
    super(new TypeOrmConnectionAdapter({...}), SQLQuerySpecificationEvaluator);
  }
}
```

### What Did Not Change

- The fluent LINQ query API (`where`, `include`, `thenInclude`, `select`, `orderBy`, `groupBy`, `distinct`, `take`, `skip`, aggregates, ...) is unchanged.
- `DbSetEntity`, `EntityRepository`, `IDbSet`, `UnitOfWork` are still exported from the core package.
- TypeORM's `DataSource`/`Connection` can still be passed directly to `DbContext` thanks to structural compatibility with `IDbConnectionAdapter`.

## TO DO

- Change tracking
- Improve the `select` API
- Split query behavior

## Authors

- **Etienne Yamsi Aka. Bugmaker** - _Initial work_ - [Bugmaker](https://github.com/bugmaker-237)

## License

This project is licensed under the ISC License - see the [LICENSE](LICENSE) file for details
