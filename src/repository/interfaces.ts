import { SlimExpressionFunction } from 'slim-exp';
import { IDbContext, IUnitOfWork } from '../uow';
import { DeepPartial } from './_internal.interface';

export { DeepPartial };
export interface QueryRefiner<T extends object> {
  (obj: IQueryable<T, T>);
}

export type EntityBase = {};
export type ExpressionResult = object | PrimitiveType;
// T extends (infer U)[] ? U : T;
export type Includable<T> = T | T[];
export type PrimitiveType = string | number | boolean;

export interface IQueryableSelectionResult<
  V extends EntityBase,
  T extends EntityBase = V
> {
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
}

export interface IQueryable<T extends EntityBase, R extends T | T[] = T, P = T>
  extends IQueryableSelectionResult<T> {
  /**
   * Specifies related entities to include in the query results. The navigation property
   * to be included is specified starting with the type of entity being queried (TEntity).
   * If you wish to include additional types based on the navigation properties of
   * the type being included, then chain a call to `thenInclude` after this call.
   * @param navigationPropertyPath The type of the related entity to be included.
   */
  include<S extends object>(
    navigationPropertyPath: SlimExpressionFunction<T, Includable<S>>
  ): IQueryable<T, R, S>;

  /**
   * Specifies additional related data to be further included based on a related type
   * that was just included.
   * @param navigationPropertyPath The type of the related entity to be included.
   */
  thenInclude<S extends object>(
    navigationPropertyPath: SlimExpressionFunction<P, Includable<S>>
  ): IQueryable<T, R, S>;

  /**
   * Filters the sequence based on a predicate.
   * @param predicate A function to test each element for a condition.
   * @param context The predicate data source
   */
  where<C extends object>(
    predicate: SlimExpressionFunction<T, boolean, C>,
    context?: C
  ): IQueryable<T, R, P>;
  /**
   * Returns a specified number of contiguous elements from the start of the sequence.
   * @param count The number of elements to return.
   */
  take(count: number): IQueryable<T, R, P>;

  /**
   * Bypasses a specified number of elements in a sequence and then returns the remaining elements.
   * @param count The number of elements to skip before returning the remaining elements.
   */
  skip(count: number): IQueryable<T, R, P>;

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
  max<O extends ExpressionResult>(
    selector: SlimExpressionFunction<T, O>
  ): Promise<O>;
  /**
   * Invokes a projection function on each element of the sequence
   * and returns the minimum resulting value.
   * @param selector A projection function to apply to each element.
   */
  min<O extends ExpressionResult>(
    selector: SlimExpressionFunction<T, O>
  ): Promise<O>;

  /**
   * Projects each element of a sequence into a new form.
   * @param selector A projection function to apply to each element.
   */
  select<V extends object>(
    selector: SlimExpressionFunction<T, V>
  ): IQueryableSelectionResult<V, R>;

  /**
   * Specifies that the current query should not have any
   * model-levelentity query filters applied.
   */
  ignoreQueryFilters(): IQueryable<T, R, P>;

  /**
   *  Sorts the elements of a sequence in descending order according to a key.
   * @param keySelector A function to extract a key from an element.
   */
  orderBy(keySelector: SlimExpressionFunction<T>): IQueryable<T, R, P>;

  /**
   * Performs a subsequent ordering of the elements in a sequence in ascending order
   * @param keySelector
   */
  thenOrderBy(keySelector: SlimExpressionFunction<T>): IQueryable<T, R, P>;

  /**
   * Sorts the elements of a sequence in ascending order according to a key.
   * @param keySelector A function to extract a key from an element.
   */
  orderByDescending(
    keySelector: SlimExpressionFunction<T>
  ): IQueryable<T, R, P>;
}

export interface IDbSet<
  T extends EntityBase,
  R extends T | T[],
  P = T,
  DT = DeepPartial<T> | T
> extends IQueryable<T, R, P> {
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
   * Creates a new entity from the given plain javascript object. If the entity already exist in the database, then it loads it (and everything related to it), replaces all values with the new ones from the given object, and returns the new entity. The new entity is actually loaded from the database entity with all properties replaced from the new object.
   * @param type The type of the enity to load
   * @param entity The partial entity values
   */
  loadRelatedData(entity: T): Promise<T>;

  ignoreQueryFilters(): IQueryable<T, R, P>;
  // join(queryable: this): this; ??
}
declare global {
  interface String {
    /**
     * Returns true if one of the searchString appears in the result
     * @param searchString search string
     */
    includes(searchStrings: string[]): boolean;
  }
  interface Number {
    /**
     * Returns true if one of the searchNumbers appears in the result
     * @param searchString search string
     */
    includes(searchNumbers: number[]): boolean;
  }
}
