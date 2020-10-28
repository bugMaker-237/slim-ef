# Slim-Exp

![logo](/slim-ef.png)

Slim-ef is an implementation of basic entity framework & LINQ functionnalities in typescript powered by [slim-exp expression parser](https://github.com/bugMaker-237/slim-exp) and [typeorm](https://github.com/typeorm/typeorm). Entity framework makes life easier for .NET developers with the help of the powerful fluent LINQ API. Many nodejs ORM exist out there. Unfortunately none of them offers a **completely string-literal-free fluent api**. Although this is normal for a .NET dev like me who will desire (and think that is a must) to work in such an environment.

### Prerequisite

- A knowledge of [typeorm](https://github.com/typeorm/typeorm)
  Actually `slim-ef` is a wrapper around typeorm. Typeorm is a pretty complete orm. which offers a lot of tools form mapping rowdata with models. Most of these functinnalities have been abstracted by `slim-ef`, but you still need to write your models with typeorm's decorators (@Column, @OnetoMany, etc...). Future versions of `slim-ef` may abstract these decorators too.

### Why you should use slim-ef

- **string-literal-free**: We know string literals are error prone. It's safer to call a function `.where((t,$)=> t.name.includes($.name)` than writing a string literal `"entity.name like 'buggy"`.
- **Refactoring becomes a pleasure**: Sometimes refactoring your model attribute name can become a pain, because you may think about the sql queries that were written with the fields hardcoded as string literals. With this, the only think you will worry about is running the migration.
- **Code readability**: Sql knowledge of the specifique database is no more useful, moreover the code is more readable (in fact, **the code read itself**)
- **Transition from .NET**: Transition from .net world is easier if you have been using entity framework

### Works/tested on

- MySQL
- MSSQL
- SQLLite
- NodeJs v12.16.2

### Installing

```
npm i slim-ef
```

### How to use

#### Setup

The design of this api was made in such a way that it ressemble as much as possible to **entity framework**
First you need to create your various models using the typeorm decorators as specified [here](https://github.com/typeorm/typeorm/blob/master/docs/entities.md)

Then you need to create a DbContext class that will inherit from slim-ef's DbContext.

```ts
...

import { Connection } from 'typeorm';
import {
  DbContext,
  DbSet,
  DbSetEntity,
  IDbSet,
  SQLQuerySpecificationEvaluator
} from 'slim-ef';
import { IDbContextOptionsBuilder, DbContextModelBuilder } from 'slim-ef/uow';

export class FakeDBContext extends DbContext {
  constructor() {
    /**
     * SQLite connection
     */
    super(
      new Connection({
        type: 'sqlite',
        database: resolve(__dirname, 'seeder', 'slim_ef_test.db'),
        entities: [Person, Agency, Trip],
        synchronize: false
      } as SqliteConnectionOptions),
      SQLQuerySpecificationEvaluator
    );
  }

  protected onModelCreation<BaseType extends object = any>(
    builder: DbContextModelBuilder<BaseType>
  ): void {
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
  public readonly persons: IDbSet<Person>;

  @DbSetEntity(Agency)
  public readonly agencies: IDbSet<Agency>;

  @DbSetEntity(Trip)
  public readonly trips: IDbSet<Trip>;
}
```

The `FakeDbContext` here represents our data strore. Each property marked with `@DbSetEntity` are data sets (collection of thier specifique type).

Slim-ef's DbContext abstract class constructor takes as param an instance TypeOrm Connection and an a specification evaluator. There is already a default implementation of a query specification evaluator in slim-ef (SQLQuerySpecificationEvaluator). You can just import it and use it.

The child DbContext needs to override onModelCreation & onConfiguring. In this version DbContextModelBuilder and IDbContextOptionsBuilder only permits you to add query filters and logger handlers respectively.

#### Availaible APIs

Data Store available APIs

```ts
interface IDbContext {
  /**
   * Begins tracking the given entity, and any other reachable entities that are not
   * already being tracked, in the Added state such that they will be inserted
   * into the database when `saveChanges()` is called.
   * @param entities
   */
  add<T>(...entities: T[]): Promise<void> | void;

  /**
   * Begins tracking the given entity and entries reachable from the given entity using
   * the Modified state by default such that they will be updated
   * in the database when `saveChanges()` is called.
   * @param entities
   */
  update<T>(...entities: T[]): Promise<void> | void;

  /**
   * Begins tracking the given entity in the Deleted state such that it will be removed
   * from the database when `saveChanges()` is called.
   * @param entities
   */
  remove<T>(...entities: T[]): Promise<void> | void;

  /**
   * Removes entities from the list of currently tracked entities
   * @param entities
   */
  unTrack<T>(...entities: T[]): Promise<void> | void;
  /**
   * Finds an entity with the given primary key values. If an entity with the given
   * primary key values is being tracked by the context, then it is returned
   * immediately without making a request to the database. Otherwise, a query is made
   * to the database for an entity with the given primary key values and this entity,
   * if found, is attached to the context and returned. If no entity is found, then
   * undefined is returned.
   * @param type The entity type
   * @param id The entity id
   */
  find<T>(type: new (...args: any) => T, id: any): Promise<T> | T;
  /**
   * Creates a database connextion and executes the given query
   * @param query
   * @param parameters
   */
  query(query: string, parameters: any[]): Promise<any>;

  /**
   * Discard all they tracked modifications of all entity types or a specific type
   * @param entityType
   */
  rollback(entityType: any | undefined): void;
  /**
   * Creates a DbSet<TEntity> that can be used to query and save instances of TEntity.
   * @param type
   */
  set<T extends object>(type: new (...args: any) => T): IDbSet<T>;

  /**
   * Saves all changes made in this context to the database.
   * This method will automatically call DetectChanges() to discover any changes to
   * entity instances before saving to the underlying database.
   */
  saveChanges(): void;

  /**
   * Releases the allocated resources for this context.
   */
  dispose(): void;
}
```

Collection available APIs

```ts
interface IDbSet<T> {
  constructor(context: IDbContext);

  /**
   * Begins tracking the given entity, and any other reachable entities that are not
   * already being tracked, in the Added state such that they will be inserted
   * into the database when `saveChanges()` is called.
   * @param entities
   */
  add(...entities: DT[]): Promise<void> | void;
  /**
   * Begins tracking the given entity and entries reachable from the given entity using
   * the Modified state by default such that they will be updated
   * in the database when `saveChanges()` is called.
   * @param entities
   */
  update(...entities: DT[]): Promise<void> | void;

  /**
   * Begins tracking the given entity in the Deleted state such that it will be removed
   * from the database when `saveChanges()` is called.
   * @param entities
   */
  remove(...entities: DT[]): Promise<void> | void;

  /**
   * Removes entities from the list of currently tracked entities
   * @param entities
   */
  unTrack(...entities: DT[]): Promise<void> | void;

  /**
   * Finds an entity with the given primary key values. If an entity with the given
   * primary key values is being tracked by the context, then it is returned
   * immediately without making a request to the database. Otherwise, a query is made
   * to the database for an entity with the given primary key values and this entity,
   * if found, is attached to the context and returned. If no entity is found, then
   * undefined is returned.
   * @param type The entity type
   * @param id The entity id
   */
  find(id: any): Promise<T> | T;

  /**
   * Checks if an entity with the given id exists in the data store
   * @param id
   */
  exists(id: any): Promise<boolean>;

  /**
   * Asynchronously returns the first element of the sequence
   */
  first(): Promise<V>;
  /**
   * Asynchronously returns the first element of the sequence that satisfies a specified condition.
   * @param predicate A function to test each element for a condition.
   * @param context The predicate data source
   */
  first<C extends object>(
    predicate: SlimExpressionFunction<T, boolean, C>,
    context?: C
  ): Promise<V>;
  /**
   * Asynchronously returns the first element of a sequence, or a default value if the sequence contains no elements.
   */
  firstOrDefault(): Promise<V>;
  /**
   * Asynchronously returns the first element of a sequence that satisfies a specified condition
   * or a default value if no such element is found.
   * @param predicate A function to test each element for a condition.
   * @param context The predicate data source
   */
  firstOrDefault<C extends object>(
    predicate: SlimExpressionFunction<T, boolean, C>,
    context?: C
  ): Promise<V>;

  /**
   * Asynchronously creates aa `Array` of result from `IQueryable` by enumerating it asynchronously.
   */
  toList(): Promise<V[]>;

  /**
   * Specifies related entities to include in the query results. The navigation property
   * to be included is specified starting with the type of entity being queried (TEntity).
   * If you wish to include additional types based on the navigation properties of
   * the type being included, then chain a call to `thenInclude` after this call.
   * @param navigationPropertyPath The type of the related entity to be included.
   */
  include<S extends object>(
    navigationPropertyPath: SlimExpressionFunction<T, S>
  ): IQueryable<T, S> & IQueryable<T, P>;

  /**
   * Specifies additional related data to be further included based on a related type
   * that was just included.
   * @param navigationPropertyPath The type of the related entity to be included.
   */
  thenInclude<S extends object>(
    navigationPropertyPath: SlimExpressionFunction<P, S>
  ): IQueryable<T, S> & IQueryable<T, P>;

  /**
   * Filters the sequence based on a predicate.
   * @param predicate A function to test each element for a condition.
   * @param context The predicate data source
   */
  where<C extends object>(
    predicate: SlimExpressionFunction<T, boolean, C>,
    context?: C
  ): IQueryable<T, P>;
  /**
   * Returns a specified number of contiguous elements from the start of the sequence.
   * @param count The number of elements to return.
   */
  take(count: number): IQueryable<T, P>;

  /**
   * Bypasses a specified number of elements in a sequence and then returns the remaining elements.
   * @param count The number of elements to skip before returning the remaining elements.
   */
  skip(count: number): IQueryable<T, P>;

  /**
   * Computes the sum of the sequence of number values that is obtained by
   * invoking a projection function on each element of the input sequence.
   * @param selector A projection function to apply to each element.
   */
  sum(selector: SlimExpressionFunction<T, number>): Promise<number>;

  /**
   * Computes the average of a sequence of number values that is obtained by
   * invoking a projection function on each element of the input sequence.
   * @param selector A projection function to apply to each element.
   */
  average(selector: SlimExpressionFunction<T, number>): Promise<number>;

  /**
   * Returns the number of elements in the specified sequence. If condition is provided,
   * the resulting elements will satisfy the condition.
   * @param predicate A function to test each element for a condition.
   */
  count<C extends object>(
    predicate?: SlimExpressionFunction<T, boolean, C>
  ): Promise<number>;
  /**
   * Invokes a projection function on each element of the sequence
   * and returns the maximum resulting value.
   * @param selector A projection function to apply to each element.
   */
  max<R extends ExpressionResult>(
    selector: SlimExpressionFunction<T, R>
  ): Promise<R>;
  /**
   * Invokes a projection function on each element of the sequence
   * and returns the minimum resulting value.
   * @param selector A projection function to apply to each element.
   */
  min<R extends ExpressionResult>(
    selector: SlimExpressionFunction<T, R>
  ): Promise<R>;

  /**
   * Projects each element of a sequence into a new form.
   * @param selector A projection function to apply to each element.
   */
  select<V extends object>(
    selector: SlimExpressionFunction<T, V>
  ): IQueryableSelectionResult<V, T>;

  /**
   * Specifies that the current query should not have any
   * model-levelentity query filters applied.
   */
  ignoreQueryFilters(): IQueryable<T, P>;

  /**
   *  Sorts the elements of a sequence in descending order according to a key.
   * @param keySelector A function to extract a key from an element.
   */
  orderBy(keySelector: SlimExpressionFunction<T>): IQueryable<T, P>;

  /**
   * Performs a subsequent ordering of the elements in a sequence in ascending order
   * @param keySelector
   */
  thenOrderBy(keySelector: SlimExpressionFunction<T>): IQueryable<T, P>;

  /**
   * Sorts the elements of a sequence in ascending order according to a key.
   * @param keySelector A function to extract a key from an element.
   */
  orderByDescending(keySelector: SlimExpressionFunction<T>): IQueryable<T, P>;
}
```

#### Examples

You can play around and do stuffs like this :smile:

```ts
  ...
  const context = new DeltaTravelDBContext();
  const pd = {
      departureDate: new Date(2000, 1, 1),
      estimatedArrivalDate: new Date(2016, 1, 1)
    };

  const tripsQuery = context.trips
    .include(t => t.agency)
    .include(t => t.passengers)
    .where(
      (t, $) =>
        t.departureDate > $.departureDate &&
        (t.estimatedArrivalDate < $.estimatedArrivalDate ||
          t.passengers.some(p => p.willTravel === true)),
      pd
    )
    .select(
      t =>
        new TripResponse(
          t.agency.name,
          t.agency.email,
          t.departureDate,
          t.passengers.map(p => ({
            name: p.lastname ,
            phone: p.phone,
            ID: p.IDNumber
          }))
        )
    );
  const res = await tripsQuery.toList();

```

For detail examples see : [Slim-ef-examples](https://github.com/bugMaker-237/slim-ef-examples)

## Not YET Supported

- The `select` api doesnot support operation evaluation, only direct assignation is supported i.e

  ```ts
  ...

  const tripsQuery = context.trips
    .include(t => t.agency)
    .include(t => t.passengers)
    .select(
      t =>
        new TripResponse(
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
        )
    );
  ```

## TO DO

- Change tracking
- Improve `select` api
- More tests!

## Usage Note

- Avoid useless paranthesis in Expression functions.

## Authors

- **Etienne Yamsi Aka. Bugmaker** - _Initial work_ - [Bugmaker](https://github.com/bugmaker-237)

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details
