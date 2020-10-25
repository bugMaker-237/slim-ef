import { BaseSpecification } from '../specification/base.specification';
import {
  FieldsSelector,
  ISpecification,
  QueryType
} from '../specification/specification.interface';
import { ExpressionResult, SlimExpressionFunction } from 'slim-exp';
import { IDbContext, IUnitOfWork } from '../uow';
import { IDbSet } from './interfaces';
import { DeepPartial } from 'typeorm';
import { patchM } from './utilis';
import { getEntitySchema } from './repository.decorator';
import { EmptySetException } from './exception';
import {
  IInternalDbContext,
  ProxyMetaDataInstance
} from '../uow/_internal.interface';

export const UnderlyingType = Symbol('__UnderlyingType');

export class DbSet<
  T extends object = any,
  R extends T = any,
  E = DeepPartial<T>
> extends BaseSpecification<T> implements IDbSet<T, R, E> {
  private _queryTypeToExecute = QueryType.ALL;
  private _lastInclude: SlimExpressionFunction<T>;
  private _currentSkip: number;
  private _currentTake: number;
  private _ignoreFilters: boolean;
  private _underlyingType: new (...args) => T;
  private _onGoingPromise: Promise<boolean>;

  constructor(context: IDbContext | IUnitOfWork);
  constructor(public context: (IDbContext | IUnitOfWork) & IInternalDbContext) {
    super();
  }

  private get [UnderlyingType]() {
    if (!this._underlyingType) {
      this._underlyingType = getEntitySchema(this);
    }
    return this._underlyingType;
  }

  private set [UnderlyingType](value) {
    if (value) {
      this._underlyingType = value;
    }
  }

  add(...entities: E[]): Promise<void> | void {
    return this.context.add(...patchM(this[UnderlyingType])(...entities));
  }

  update(...entities: E[]): Promise<void> | void {
    return this.context.update(...patchM(this[UnderlyingType])(...entities));
  }

  unTrack(...entities: E[]): Promise<void> | void {
    return this.context.unTrack(...patchM(this[UnderlyingType])(...entities));
  }

  remove(...entities: E[]): Promise<void> | void {
    return this.context.remove(...patchM(this[UnderlyingType])(...entities));
  }

  async find(id: any): Promise<T> {
    return await this.context.find<T>(this[UnderlyingType], id);
  }

  async exists(id: any): Promise<boolean> {
    return !!(await this.find(id));
  }

  async firstOrDefault(): Promise<T>;
  async firstOrDefault<C extends object>(
    func: SlimExpressionFunction<T, boolean, C>,
    context: C
  ): Promise<T>;
  async firstOrDefault<C extends object>(
    func?: SlimExpressionFunction<T, boolean, C>
  ): Promise<T>;
  async firstOrDefault<C extends object>(
    func?: SlimExpressionFunction<T, boolean, C>,
    context?: C
  ): Promise<T> {
    this.applyPaging(0, 1);
    this.where(func, context);
    return await this.execute<T>(QueryType.ONE);
  }

  async first(): Promise<T>;
  async first<C extends object>(
    func: SlimExpressionFunction<T, boolean, C>,
    context: C
  ): Promise<T>;
  async first<C extends object>(
    func?: SlimExpressionFunction<T, boolean, C>
  ): Promise<T>;
  async first<C extends object>(
    func?: SlimExpressionFunction<T, boolean, C>,
    context?: C
  ): Promise<T> {
    const elt = await this.firstOrDefault(func, context);
    if (!elt) throw new EmptySetException();

    return elt;
  }

  include<S extends object>(include: SlimExpressionFunction<T, S>) {
    this._lastInclude = include;
    this.addInclude(include);
    return this;
  }
  thenInclude<S extends object>(include: SlimExpressionFunction<S>) {
    this.addChainedInclude(this._lastInclude, include);
    return this;
  }
  where<C extends object>(func: SlimExpressionFunction<T, boolean, C>): this;
  where<C extends object>(
    func: SlimExpressionFunction<T, boolean, C>,
    context: C
  ): this;
  where<C extends object>(
    func: SlimExpressionFunction<T, boolean, C>,
    context: C | null = null
  ): this {
    this.addCriteria(func, context);
    return this;
  }
  take(count: number) {
    this.applyPaging(this._currentSkip, count);
    this._currentTake = count;
    return this;
  }
  skip(count: number) {
    this.applyPaging(count, this._currentTake);
    this._currentSkip = count;
    return this;
  }

  select<V extends object>(func: SlimExpressionFunction<T, V>) {
    const thisType = this[UnderlyingType];
    this._onGoingPromise = this.context
      .getMetadata(thisType)
      .then(proxyInstance => {
        const res = func(proxyInstance as T) as ProxyMetaDataInstance<V>;
        const fieldsToSelect = this._extractKeyFields<V>(res);
        const selector: FieldsSelector<T> = {
          builder: func,
          fieldsToSelect
        };
        this.applySelector(selector);
        return true;
      })
      .catch(rej => {
        throw new Error(rej);
      });

    return this as any;
  }

  private _extractKeyFields<V extends object>(
    res: ProxyMetaDataInstance<V>
  ): {
    field: string;
  }[] {
    const fieldsToSelect = [];
    for (const k in res) {
      if (Object.prototype.hasOwnProperty.call(res, k)) {
        const element = res[k];
        if (!Array.isArray(element)) {
          fieldsToSelect.push({
            field: element.$$propertyName
          });
        } else {
          const arrElt = element[0];
          fieldsToSelect.push(
            ...this._extractKeyFields(arrElt).map(e => ({
              field: `${e.field}`
            }))
          );
        }
      }
    }
    return fieldsToSelect;
  }

  async count<C extends object>(
    func?: SlimExpressionFunction<T, boolean, C>
  ): Promise<number> {
    this.addCriteria(func);
    this.applyFunction('COUNT', null);
    return Number.parseFloat(
      (await this.execute<{ COUNT: string }>(QueryType.RAW_ONE)).COUNT
    );
  }

  async sum(field: SlimExpressionFunction<T, number>): Promise<number> {
    this.applyFunction('SUM', field);
    return Number.parseFloat(
      (await this.execute<{ SUM: string }>(QueryType.RAW_ONE)).SUM
    );
  }

  async average(field: SlimExpressionFunction<T, number>): Promise<number> {
    this.applyFunction('AVG', field);
    return Number.parseFloat(
      (await this.execute<{ AVG: string }>(QueryType.RAW_ONE)).AVG
    );
  }

  async max<RT extends ExpressionResult>(
    field: SlimExpressionFunction<T, RT>
  ): Promise<RT> {
    this.applyFunction('MAX', field);
    return (await this.execute<{ MAX: RT }>(QueryType.RAW_ONE)).MAX;
  }
  async min<RT extends ExpressionResult>(
    field: SlimExpressionFunction<T, RT>
  ): Promise<RT> {
    this.applyFunction('MIN', field);
    return (await this.execute<{ MIN: RT }>(QueryType.RAW_ONE)).MIN;
  }

  orderBy(orderBy: SlimExpressionFunction<T>) {
    this.applyOrderBy(orderBy);
    return this;
  }

  thenOrderBy(thenOrderBy: SlimExpressionFunction<T>) {
    this.applyThenOrderBy(thenOrderBy);
    return this;
  }

  orderByDescending(orderBy: SlimExpressionFunction<T>) {
    this.applyOrderByDescending(orderBy);
    return this;
  }

  asSpecification(): ISpecification<T> {
    return this;
  }

  ignoreQueryFilters(): this {
    this._ignoreFilters = true;
    return this;
  }

  fromSpecification(spec: ISpecification<T>): IDbSet<T> {
    this.extend(spec);
    this.applySelector(spec.getSelector());
    this.applyOrderBy(spec.getOrderBy());
    this.applyOrderByDescending(spec.getOrderByDescending());
    this.applyThenOrderBy(spec.getThenBy());
    return this;
  }

  async toList(): Promise<T[]> {
    return await this.execute(this._queryTypeToExecute);
  }

  private async execute<TResult>(type: QueryType): Promise<TResult> {
    if (!this._onGoingPromise || (await this._onGoingPromise)) {
      const res = (await this.context.execute(
        this,
        type,
        this._ignoreFilters
      )) as TResult;
      this.clearSpecs();
      return res;
    }
  }

  then<TResult1 = T[], TResult2 = never>(
    onfulfilled?: (value: T[]) => TResult1 | PromiseLike<TResult1>,
    onrejected?: (reason: any) => TResult2 | PromiseLike<TResult2>
  ): PromiseLike<TResult1 | TResult2> {
    return this.toList().then(onfulfilled, onrejected);
  }
}
