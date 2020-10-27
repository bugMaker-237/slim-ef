import { SlimExpressionFunction } from 'slim-exp';
import { IDbContext, IUnitOfWork } from '../uow';
import { DeepPartial } from './_internal.interface';

export interface QueryRefiner<T extends object> {
  (obj: IQueryable<T>);
}

export type ExpressionResult = object | PrimitiveType;

export type PrimitiveType = string | number | boolean;

interface IQueryableSelectionResult<V extends object, T extends object = any> {
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

export interface IQueryable<T extends object, P extends ExpressionResult = any>
  extends IQueryableSelectionResult<T> {
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
  ignoreQueryFilters(): IQueryable<T, P>;
  orderBy(orderBy: SlimExpressionFunction<T>): IQueryable<T, P>;
  thenOrderBy(thenOrderBy: SlimExpressionFunction<T>): IQueryable<T, P>;
  orderByDescending(orderBy: SlimExpressionFunction<T>): IQueryable<T, P>;
}

export declare class IDbSet<
  T extends object,
  P extends ExpressionResult = any,
  DT = DeepPartial<T>
> implements IQueryable<T, P> {
  constructor(context: IDbContext | IUnitOfWork);
  first(): Promise<T>;
  first<C extends object>(
    func: SlimExpressionFunction<T, boolean, C>,
    context?: C
  ): Promise<T>;
  firstOrDefault(): Promise<T>;
  firstOrDefault<C extends object>(
    func: SlimExpressionFunction<T, boolean, C>,
    context?: C
  ): Promise<T>;
  toList(): Promise<T[]>;
  include<S extends object>(
    includes: SlimExpressionFunction<T, S, any>
  ): IQueryable<T, S> & IQueryable<T, P>;
  thenInclude<S extends object>(
    includes: SlimExpressionFunction<P, S, any>
  ): IQueryable<T, S> & IQueryable<T, P>;
  where<C extends object>(
    func: SlimExpressionFunction<T, boolean, C>,
    context?: C
  ): IQueryable<T, P>;
  take(count: number): IQueryable<T, P>;
  skip(count: number): IQueryable<T, P>;
  sum(field: SlimExpressionFunction<T, number>): Promise<number>;
  average(field: SlimExpressionFunction<T, number>): Promise<number>;
  count<C extends object>(
    func?: SlimExpressionFunction<T, boolean, C>
  ): Promise<number>;
  max<R extends ExpressionResult>(
    field: SlimExpressionFunction<T, R>
  ): Promise<R>;
  min<R extends ExpressionResult>(
    field: SlimExpressionFunction<T, R>
  ): Promise<R>;
  select<V extends object>(
    func: SlimExpressionFunction<T, V>
  ): IQueryableSelectionResult<V, T>;
  orderBy(orderBy: SlimExpressionFunction<T, any, any>): IQueryable<T, P>;
  thenOrderBy(
    thenOrderBy: SlimExpressionFunction<T, any, any>
  ): IQueryable<T, P>;
  orderByDescending(
    orderBy: SlimExpressionFunction<T, any, any>
  ): IQueryable<T, P>;
  add(...entities: DT[]): Promise<void> | void;
  update(...entities: DT[]): Promise<void> | void;
  remove(...entities: DT[]): Promise<void> | void;
  unTrack(...entities: DT[]): Promise<void> | void;
  find(id: any): Promise<T> | T;
  exists(id: any): Promise<boolean>;
  ignoreQueryFilters(): IQueryable<T, P>;
  // join(queryable: this): this; ??
}
