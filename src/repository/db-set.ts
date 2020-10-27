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
    predicate: SlimExpressionFunction<T, boolean, C>,
    // tslint:disable-next-line: unified-signatures
    context: C
  ): Promise<T>;
  async firstOrDefault<C extends object>(
    predicate?: SlimExpressionFunction<T, boolean, C>
  ): Promise<T>;
  async firstOrDefault<C extends object>(
    predicate?: SlimExpressionFunction<T, boolean, C>,
    context?: C
  ): Promise<T> {
    this.applyPaging(0, 1);
    this.where(predicate, context);
    return await this.execute<T>(QueryType.ONE);
  }

  async first(): Promise<T>;
  async first<C extends object>(
    predicate: SlimExpressionFunction<T, boolean, C>,
    // tslint:disable-next-line: unified-signatures
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

  include<S extends object>(
    navigationPropertyPath: SlimExpressionFunction<T, S>
  ) {
    this._lastInclude = navigationPropertyPath;
    this.addInclude(navigationPropertyPath);
    return this;
  }
  thenInclude<S extends object>(
    navigationPropertyPath: SlimExpressionFunction<S>
  ) {
    this.addChainedInclude(this._lastInclude, navigationPropertyPath);
    return this;
  }
  where<C extends object>(
    predicate: SlimExpressionFunction<T, boolean, C>
  ): this;
  where<C extends object>(
    predicate: SlimExpressionFunction<T, boolean, C>,
    // tslint:disable-next-line: unified-signatures
    context: C
  ): this;
  where<C extends object>(
    predicate: SlimExpressionFunction<T, boolean, C>,
    context: C | null = null
  ): this {
    this.addCriteria(predicate, context);
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

  select<V extends object>(selector: SlimExpressionFunction<T, V>) {
    const thisType = this[UnderlyingType];
    this._onGoingPromise = this.context
      .getMetadata(thisType)
      .then(proxyInstance => {
        const res = selector(proxyInstance as T) as ProxyMetaDataInstance<V>;
        const fieldsToSelect = this._extractKeyFields<V>(res);
        const s: FieldsSelector<T> = {
          builder: selector,
          fieldsToSelect
        };
        this.applySelector(s);
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
    predicate?: SlimExpressionFunction<T, boolean, C>
  ): Promise<number> {
    this.addCriteria(predicate);
    this.applyFunction('COUNT', null);
    return Number.parseFloat(
      (await this.execute<{ COUNT: string }>(QueryType.RAW_ONE)).COUNT
    );
  }

  async sum(selector: SlimExpressionFunction<T, number>): Promise<number> {
    this.applyFunction('SUM', selector);
    return Number.parseFloat(
      (await this.execute<{ SUM: string }>(QueryType.RAW_ONE)).SUM
    );
  }

  async average(selector: SlimExpressionFunction<T, number>): Promise<number> {
    this.applyFunction('AVG', selector);
    return Number.parseFloat(
      (await this.execute<{ AVG: string }>(QueryType.RAW_ONE)).AVG
    );
  }

  async max<RT extends ExpressionResult>(
    selector: SlimExpressionFunction<T, RT>
  ): Promise<RT> {
    this.applyFunction('MAX', selector);
    return (await this.execute<{ MAX: RT }>(QueryType.RAW_ONE)).MAX;
  }
  async min<RT extends ExpressionResult>(
    selector: SlimExpressionFunction<T, RT>
  ): Promise<RT> {
    this.applyFunction('MIN', selector);
    return (await this.execute<{ MIN: RT }>(QueryType.RAW_ONE)).MIN;
  }

  orderBy(keySelector: SlimExpressionFunction<T>) {
    this.applyOrderBy(keySelector);
    return this;
  }

  thenOrderBy(keySelector: SlimExpressionFunction<T>) {
    this.applyThenOrderBy(keySelector);
    return this;
  }

  orderByDescending(keySelector: SlimExpressionFunction<T>) {
    this.applyOrderByDescending(keySelector);
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
