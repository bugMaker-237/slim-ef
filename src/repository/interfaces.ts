import { SlimExpressionFunction } from 'slim-exp';
import { IDbContext, IUnitOfWork } from '../uow';
import { DeepPartial } from './_internal.interface';

export interface QueryRefiner<T extends object> {
  (obj: IQueryable<T>);
}

export type ExpressionResult = object | PrimitiveType;

export type PrimitiveType = string | number | boolean;

interface IQueryableSelectionResult<V extends object, T extends object = any> {
  first(): Promise<V>;
  first<C extends object>(
    func: SlimExpressionFunction<T, boolean, C>,
    context?: C
  ): Promise<V>;
  firstOrDefault(): Promise<V>;
  firstOrDefault<C extends object>(
    func: SlimExpressionFunction<T, boolean, C>,
    context?: C
  ): Promise<V>;
  toList(): Promise<V[]>;
}

export interface IQueryable<T extends object, P extends ExpressionResult = any>
  extends IQueryableSelectionResult<T> {
  include<S extends object>(
    includes: SlimExpressionFunction<T, S>
  ): IQueryable<T, S> & IQueryable<T, P>;
  thenInclude<S extends object>(
    includes: SlimExpressionFunction<P, S>
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
  sum(field: SlimExpressionFunction<T, number, any>): Promise<number>;
  average(field: SlimExpressionFunction<T, number, any>): Promise<number>;
  count<C extends object>(
    func?: SlimExpressionFunction<T, boolean, C>
  ): Promise<number>;
  max<R extends ExpressionResult>(
    field: SlimExpressionFunction<T, R, any>
  ): Promise<R>;
  min<R extends ExpressionResult>(
    field: SlimExpressionFunction<T, R, any>
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
