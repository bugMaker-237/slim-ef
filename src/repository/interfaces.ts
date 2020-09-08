import { SlimExpressionFunction } from 'slim-exp';
import { DeepPartial } from 'typeorm';
import {
  FieldsSelector,
  ISpecification
} from '../specification/specification.interface';

export interface QueryRefiner<T extends object> {
  (obj: IQueryable<T>);
}

export type ExpressionResult = object | PrimitiveType;

export type PrimitiveType = string | number | boolean;

export interface IQueryable<
  T extends object,
  P extends ExpressionResult = any
> {
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
    includes: SlimExpressionFunction<T, S>
  ): IQueryable<T, S> & this;
  thenInclude<S extends object>(
    includes: SlimExpressionFunction<P, S>
  ): IQueryable<T, S> & this;
  where<C extends object>(
    func: SlimExpressionFunction<T, boolean, C>,
    context?: C
  ): this;
  take(count: number): this;
  skip(count: number): this;
  sum(field: SlimExpressionFunction<T, number>): Promise<number>;
  average(field: SlimExpressionFunction<T, number>): Promise<number>;
  count(field?: SlimExpressionFunction<T>): Promise<number>;
  max<R extends ExpressionResult>(
    field: SlimExpressionFunction<T, R>
  ): Promise<R>;
  min<R extends ExpressionResult>(
    field: SlimExpressionFunction<T, R>
  ): Promise<R>;
  select<R extends ExpressionResult>(
    field: SlimExpressionFunction<T, R>
  ): Promise<R>;
  select(
    selector: SlimExpressionFunction<T>,
    ...selectors: SlimExpressionFunction<T>[]
  ): this;
  orderBy(orderBy: SlimExpressionFunction<T>): this;
  thenOrderBy(thenOrderBy: SlimExpressionFunction<T>): this;
  orderByDescending(orderBy: SlimExpressionFunction<T>): this;
}

export interface IDbSet<
  T extends object,
  P extends ExpressionResult = any,
  Q = DeepPartial<T>
> extends IQueryable<T, P> {
  add(...entities: Q[]): Promise<void> | void;
  attach(...entities: Q[]): Promise<void> | void;
  remove(...entities: Q[]): Promise<void> | void;
  detach(...entities: Q[]): Promise<void> | void;
  find(id: any): Promise<T> | T;
  // join(queryable: this): this; ??
}
