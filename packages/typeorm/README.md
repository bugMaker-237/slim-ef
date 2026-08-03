# @slim-ef/typeorm

TypeORM adapter for [slim-ef](https://github.com/BugMaker-237/slim-ef). It wires the ORM-agnostic `@slim-ef/core` framework to [TypeORM](https://github.com/typeorm/typeorm) by providing:

- `TypeOrmConnectionAdapter` — an `IDbConnectionAdapter` that wraps a TypeORM `DataSource` (connection, query runners, repositories, entity metadata).
- `SQLQuerySpecificationEvaluator` — an `IQuerySpecificationEvaluator` that translates a slim-ef `ISpecification` into a TypeORM `SelectQueryBuilder`.
- `SQLQuerySpecificationException` — the error type thrown when a specification cannot be translated to SQL.

## Install

```bash
npm i @slim-ef/core @slim-ef/typeorm typeorm
```

`@slim-ef/core` and `typeorm` are peer dependencies — install them alongside.

## Quick start

Define your entities with TypeORM (`EntitySchema` or decorators), then pass them to the adapter:

```ts
import { DbContext, DbContextModelBuilder, DbSetEntity, IDbSet } from '@slim-ef/core';
import { TypeOrmConnectionAdapter, SQLQuerySpecificationEvaluator } from '@slim-ef/typeorm';
import { Person, PersonSchema } from './entities/person';

export class AppDbContext extends DbContext {
  constructor() {
    super(
      new TypeOrmConnectionAdapter({
        type: 'better-sqlite3',
        database: 'app.db',
        entities: [PersonSchema],
        synchronize: true
      }),
      SQLQuerySpecificationEvaluator
    );
  }

  protected onModelCreation(builder: DbContextModelBuilder): void {
    builder.entity(Person).hasQueryFilter(q => q.where(e => e.IDNumber > 50));
  }

  protected onConfiguring(optionsBuilder): void {}

  @DbSetEntity(Person)
  public readonly persons!: IDbSet<Person, Person>;
}
```

> The adapter is structurally compatible with TypeORM's own types, so an existing `DataSource` can be used directly.

## Samples

### Querying

```ts
const context = new AppDbContext();

const all = await context.persons.toList();
const buggy = await context.persons.first(p => p.firstname === 'Buggy');
const adults = await context.persons.where(p => p.IDNumber > 500000).toList();

const ctx = { min: new Date(2000, 0, 1) };
const recent = await context.persons
  .where((p, $) => p.createdAt > $.min, ctx)
  .toList();
```

### Includes & projections

```ts
const people = await context.persons
  .include(p => p.trip)
  .thenInclude(t => t.agency)
  .toList();

const summary = await context.trips
  .include(t => t.agency)
  .include(t => t.passengers)
  .select(t => ({
    agency: t.agency.name,
    departureDate: t.departureDate,
    passengers: t.passengers.map(p => p.lastname)
  }))
  .toList();
```

### Ordering, paging, grouping & distinct

```ts
const sorted = await context.persons.orderByDescending(p => p.IDNumber).toList();
const page = await context.persons.orderBy(p => p.IDNumber).skip(10).take(10).toList();
const grouped = await context.persons.groupBy(p => p.willTravel).toList();
const distinct = await context.trips.select(t => ({ aId: t.agencyId })).distinct().toList();
```

### Aggregates

```ts
const count = await context.persons.count(p => p.willTravel === true);
const sum = await context.persons.sum(p => p.IDNumber);
const avg = await context.persons.average(p => p.IDNumber);
const min = await context.persons.min(p => p.firstname);
const max = await context.persons.max(p => p.firstname);
```

### CRUD & transactions

```ts
// Add
context.persons.add({ firstname: 'Buggy', lastname: 'Maker', IDNumber: 800, phone: '+237' });
const { added } = await context.saveChanges();

// Remove
context.persons.remove(added[0]);
await context.saveChanges();

// Transaction
await context.openTransaction();
context.persons.add(person);
await context.saveChanges();
await context.rollbackTransaction(); // discards the insert
```

### Query filters

```ts
// Defined in onModelCreation: IDNumber > 50
const filtered = await context.persons.firstOrDefault(p => p.IDNumber === 5); // undefined
const ignored = await context.persons.ignoreQueryFilters().firstOrDefault(p => p.IDNumber === 5);
```

### Error handling

Specifications that cannot be translated to SQL throw `SQLQuerySpecificationException`:

```ts
import { SQLQuerySpecificationException } from '@slim-ef/typeorm';

try {
  await context.persons.where(p => p.trip.someUnknown).toList();
} catch (e) {
  if (e instanceof SQLQuerySpecificationException) {
    console.error('Invalid query:', e.message);
  }
}
```

## Exports

| Export | Description |
|--------|-------------|
| `TypeOrmConnectionAdapter` | Wraps a TypeORM `DataSource` behind `IDbConnectionAdapter`. |
| `SQLQuerySpecificationEvaluator` | Translates slim-ef specifications into TypeORM queries. |
| `SQLQuerySpecificationException` | Error thrown for untranslatable specifications. |

## License

ISC — see [LICENSE](../../LICENSE).
