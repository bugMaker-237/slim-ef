# @slim-ef/core

Slim-EF is an implementation of basic Entity Framework & LINQ functionalities in TypeScript, powered by the [slim-exp expression parser](https://github.com/bugMaker-237/slim-exp). It provides a **completely string-literal-free fluent API**.

This package is the framework core: the fluent LINQ query API, `DbContext`/`UnitOfWork`, `DbSet`, specifications and the ORM-agnostic abstractions. It has **no runtime dependency on any specific ORM** — plug in any adapter (e.g. [`@slim-ef/typeorm`](https://github.com/BugMaker-237/slim-ef/tree/main/packages/typeorm)) by implementing `IDbConnectionAdapter` and `IQuerySpecificationEvaluator`.

## Install

```bash
npm i @slim-ef/core
```

You also need a database adapter, e.g.:

```bash
npm i @slim-ef/typeorm typeorm
```

## Features

- **String-literal-free LINQ** — `.where((t, $) => t.age > $.minAge)` instead of `"age > :minAge"`.
- `DbContext` / `UnitOfWork` change tracking (`add`, `update`, `remove`, `unTrack`, `rollback`, `saveChanges`).
- Fluent queries: `where`, `include`/`thenInclude`, `select`, `orderBy`/`orderByDescending`/`thenOrderBy`, `groupBy`/`thenGroupBy`, `take`/`skip`, `distinct`.
- Aggregates: `count`, `sum`, `average`, `min`, `max`.
- Global query filters with `ignoreQueryFilters()`.
- Transactions (`openTransaction`/`commitTransaction`/`rollbackTransaction`).
- Repository pattern: `EntityRepository` + `GenericRepository` + `UnitOfWork`.
- ORM-agnostic abstractions for custom adapters.

## Setup

Define your models with your ORM (decorators or `EntitySchema`), then create a `DbContext`:

```ts
import {
  DbContext,
  DbContextModelBuilder,
  DbSetEntity,
  IDbContextOptionsBuilder,
  IDbSet
} from '@slim-ef/core';
import { Person, PersonSchema } from './entities/person';

export class AppDbContext extends DbContext {
  constructor() {
    super(
      new YourDBConnectionAdapter({
        type: 'better-sqlite3',
        database: 'app.db',
        entities: [PersonSchema],
        synchronize: true
      }),
      YourSQLQuerySpecificationEvaluator
    );
  }

  protected onModelCreation(builder: DbContextModelBuilder): void {
    // Global query filter applied to every Person query
    builder.entity(Person).hasQueryFilter(q => q.where(e => e.IDNumber > 50));
  }

  protected onConfiguring(optionsBuilder: IDbContextOptionsBuilder): void {}

  @DbSetEntity(Person)
  public readonly persons!: IDbSet<Person, Person>;
}
```

## Samples

> `context` below is an `AppDbContext`.

### CRUD

```ts
// Add
const person = new Person();
person.firstname = 'Buggy';
person.lastname = 'Maker';
person.IDNumber = 800;
context.persons.add(person);
const { added } = await context.saveChanges(); // added[0].id is populated

// Update
let dbPerson = await context.persons.first();
context.persons.update({ ...dbPerson, firstname: 'Bug' });
await context.saveChanges();

// Remove
const toDelete = await context.persons.first();
context.persons.remove(toDelete);
await context.saveChanges();

// Stop tracking a staged entity
context.persons.add(person);
context.persons.unTrack(person);
await context.saveChanges(); // nothing persisted

// Roll back all staged changes of a type
context.persons.add(person);
context.rollback(Person);
await context.saveChanges(); // person is not inserted
```

### Find & existence

```ts
const person = await context.persons.first();
const found = await context.persons.find(person.id); // entity or undefined
const exists = await context.persons.exists(person.id); // boolean

const rows = await context.query('SELECT COUNT(*) AS cnt FROM person', []);
const set = context.set(Person); // ad-hoc DbSet
```

### Querying

```ts
const all = await context.persons.toList();
const first = await context.persons.first(); // throws if empty
const buggy = await context.persons.first(p => p.firstname === 'Buggy');
const maybe = await context.persons.firstOrDefault(p => p.id === 'x'); // undefined
```

### Filtering

```ts
await context.persons.where(p => p.IDNumber > 500000).toList();
await context.persons.where(p => p.willTravel === true).toList();
await context.persons.where(p => !p.willTravel).toList();

await context.persons.first(
  p => p.firstname === 'Buggy' && p.lastname === 'Maker'
);

await context.persons.where(p => p.firstname.startsWith('Bugg')).toList();
await context.persons.where(p => p.lastname.endsWith('uggy')).toList();
await context.persons.where(p => p.firstname.includes('gg')).toList();
```

### Filtering with an external context (`$`)

The second argument to `where`/`first`/`firstOrDefault`/`count` is a plain object. Its values are
referenced inside the lambda through the `$` marker, so you never build a query string by
concatenating values.

```ts
// Bind a runtime value (dates, ids, numbers) to a comparison
const ctx = {
  departureDate: new Date(2000, 1, 1),
  estimatedArrivalDate: new Date(2016, 1, 1)
};
const trips = await context.trips
  .where(
    (t, $) =>
      t.departureDate > $.departureDate &&
      t.estimatedArrivalDate! < $.estimatedArrivalDate,
    ctx
  )
  .toList();

// Compare a column against a numeric context value
const minAge = { min: 500000 };
await context.persons.where((p, $) => p.IDNumber > $.min, minAge).toList();

// Filter by a foreign key obtained at runtime
const agency = await context.agencies.first();
await context.trips
  .where((t, $) => t.agencyId === $.id, { id: agency.id })
  .toList();

// String search built from user input, still without any string literal SQL
const search = { term: 'Bug' };
await context.persons
  .where(p => p.firstname.includes($.term), search)
  .toList();

// Combine context with relationship + boolean logic
const pd = {
  departureDate: new Date(2000, 1, 1),
  estimatedArrivalDate: new Date(2016, 1, 1)
};
await context.trips
  .include(t => t.passengers)
  .where(
    (t, $) =>
      t.departureDate > $.departureDate &&
      (t.estimatedArrivalDate! < $.estimatedArrivalDate ||
        t.passengers.some(p => p.willTravel === true)),
    pd
  )
  .toList();

// Context works with every query method: first, count, firstOrDefault, ...
const buggy = await context.persons.first(
  (p, $) => p.firstname === $.name && p.lastname === $.lastname,
  { name: 'Buggy', lastname: 'Maker' }
);
const total = await context.persons.count((p, $) => p.IDNumber > $.min, {
  min: 500000
});

// Nested properties inside the context object are supported too
const range = { range: { from: 500000, to: 900000 } };
await context.persons
  .where(
    (p, $) => p.IDNumber > $.range.from && p.IDNumber < $.range.to,
    range
  )
  .toList();
```

### Includes

```ts
const persons = await context.persons
  .include(p => p.trip)
  .thenInclude(t => t.agency)
  .toList();
```

### Projections

```ts
const projections = await context.persons
  .include(p => p.trip)
  .thenInclude(t => t.agency)
  .select(p => ({
    departureDate: p.trip.departureDate,
    agency: p.trip.agency!.name
  }))
  .toList();
```

> Relation fields referenced inside `select` must be included with `.include()`/`.thenInclude()`.

### Ordering, paging, grouping

```ts
const asc = await context.persons.orderBy(p => p.IDNumber).toList();
const desc = await context.persons.orderByDescending(p => p.IDNumber).toList();
const secondary = await context.persons
  .orderBy(p => p.willTravel)
  .thenOrderBy(p => p.firstname)
  .toList();

const page = await context.persons
  .orderBy(p => p.IDNumber)
  .skip(10)
  .take(10)
  .toList();

const grouped = await context.persons.groupBy(p => p.willTravel).toList();
```

### Aggregates

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
const ids = await context.persons
  .select(p => ({ id: p.tripId }))
  .distinct()
  .toList();
```

### Query filters

```ts
const filtered = await context.persons.firstOrDefault(p => p.IDNumber === 5); // undefined
const ignored = await context.persons
  .ignoreQueryFilters()
  .firstOrDefault(p => p.IDNumber === 5); // found
```

### Transactions

```ts
await context.openTransaction();
context.persons.add(person);
await context.saveChanges();
await context.rollbackTransaction(); // discards the insert
// ...or await context.commitTransaction(); // commits the insert
```

### Repository pattern

```ts
import { EntityRepository, GenericRepository, UnitOfWork } from '@slim-ef/core';

export const uow = new (class UOW extends UnitOfWork {
  constructor() {
    super(connectionAdapter, SQLQuerySpecificationEvaluator);
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
```

## API overview

### DbContext

`add`, `update`, `remove`, `unTrack`, `find`, `query`, `rollback`, `set`, `saveChanges`, `openTransaction`, `commitTransaction`, `rollbackTransaction`, `transactionIsOpen`, `loadRelatedData`, `dispose`

### IDbSet / IQueryable

`add`, `update`, `remove`, `unTrack`, `find`, `exists`, `loadRelatedData`, `first`, `firstOrDefault`, `toList`, `include`, `thenInclude`, `where`, `take`, `skip`, `select`, `count`, `sum`, `average`, `min`, `max`, `orderBy`, `orderByDescending`, `thenOrderBy`, `groupBy`, `thenGroupBy`, `distinct`, `ignoreQueryFilters`, `asSpecification`, `fromSpecification`

### Extensibility

| Interface                                                           | Purpose                                                            |
| ------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `IDbConnectionAdapter`                                              | Abstraction over a database connection.                            |
| `IDbRepository<T>`                                                  | Abstraction over a repository for one entity type.                 |
| `IQueryRunner`                                                      | Abstraction over a transaction runner.                             |
| `IEntityManager`                                                    | Abstraction over the entity manager (preload).                     |
| `IEntityMetadata`/`IEntityColumnMetadata`/`IEntityRelationMetadata` | Metadata shapes used by the proxy builder.                         |
| `ISpecification`/`BaseSpecification`                                | Reusable query descriptions.                                       |
| `IQuerySpecificationEvaluator`                                      | Contract for translating a specification into an executable query. |

## License

ISC — see [LICENSE](../../LICENSE).
