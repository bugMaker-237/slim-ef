import { BaseSpecification } from '../specification/base.specification';
import {
  FieldsSelector,
  ISpecification,
  QueryType
} from '../specification/specification.interface';
import { ExpressionResult, SlimExpressionFunction } from 'slim-exp';
import { IDbContext, IUnitOfWork } from '../uow';
import {
  EntityBase,
  IDbSet,
  Includable,
  IQueryable,
  IQueryableSelectionResult
} from './interfaces';
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
  T extends EntityBase,
  R extends T | T[] = T,
  P = T,
  E = T | DeepPartial<T>
> implements IDbSet<T, R, P, E> {
  private _queryTypeToExecute = QueryType.ALL;
  private _baseSpec = new BaseSpecification<T>();
  private _lastInclude: SlimExpressionFunction<T>;
  private _currentSkip: number;
  private _currentTake: number;
  private _ignoreFilters: boolean;
  private _underlyingType: new (...args) => T;
  private _onGoingPromise: Promise<boolean>;

  constructor(context: IDbContext | IUnitOfWork);
  constructor(
    public context: (IDbContext | IUnitOfWork) & IInternalDbContext
  ) {}

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

  loadRelatedData(entity: T): Promise<T> {
    return this.context.loadRelatedData(this._underlyingType, entity);
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
    this._baseSpec.applyPaging(0, 1);
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
    navigationPropertyPath: SlimExpressionFunction<T, Includable<S>>
  ) {
    this._lastInclude = navigationPropertyPath;
    this._baseSpec.addInclude(navigationPropertyPath);
    return (this as unknown) as IQueryable<T, R, S>;
  }
  thenInclude<S extends object>(
    navigationPropertyPath: SlimExpressionFunction<P, Includable<S>>
  ) {
    this._baseSpec.addChainedInclude(this._lastInclude, navigationPropertyPath);
    return (this as unknown) as IQueryable<T, R, S>;
  }

  where<C extends object>(
    predicate: SlimExpressionFunction<T, boolean, C>,
    context?: C
  ): IQueryable<T, R, P> {
    this._baseSpec.addCriteria(predicate, context);
    return (this as unknown) as IQueryable<T, R, P>;
  }
  take(count: number): IQueryable<T, R, P> {
    this._baseSpec.applyPaging(this._currentSkip, count);
    this._currentTake = count;
    return this as IQueryable<T, R, P>;
  }
  skip(count: number): IQueryable<T, R, P> {
    this._baseSpec.applyPaging(count, this._currentTake);
    this._currentSkip = count;
    return this as IQueryable<T, R, P>;
  }

  select<V extends object>(selector: SlimExpressionFunction<T, V>) {
    const thisType = this[UnderlyingType];
    const includePaths = this._getIncludePaths();
    this._onGoingPromise = this.context
      .getMetadata(thisType, includePaths)
      .then(proxyInstance => {
        const res = selector(proxyInstance as any) as ProxyMetaDataInstance<V>;
        const fieldsToSelect = this._extractKeyFields<V>(res);
        const s: FieldsSelector<T> = {
          builder: selector,
          fieldsToSelect
        };
        this._baseSpec.applySelector(s);
        return true;
      })
      .catch(rej => {
        if (
          rej.message &&
          rej.message.includes('Cannot read property') &&
          rej.message.includes('of undefined')
        ) {
          throw new Error(
            'Select proxy cannot be build. You may have forget to include some properties using `.include` or `.thenInclude` or may be the selected property is not part of the entity schema. Internal Error: ' +
              rej.message
          );
        } else {
          throw new Error(rej);
        }
      });

    return (this as unknown) as IQueryableSelectionResult<V, R>;
  }
  private _getIncludePaths(): string[] {
    const spec = this.asSpecification();
    return spec.getIncludePaths();
  }

  private _extractKeyFields<V extends object>(
    res: ProxyMetaDataInstance<V>
  ): {
    field: string;
  }[] {
    const fieldsToSelect = [];
    for (const k in res) {
      if (
        k !== '$$propertyName' &&
        Object.prototype.hasOwnProperty.call(res, k)
      ) {
        const element = res[k];
        if (!element) continue;
        if (!Array.isArray(element)) {
          const canGrind =
            !(element instanceof String) &&
            !(element instanceof Number) &&
            !(element instanceof Boolean) &&
            element instanceof Object;
          if (canGrind) {
            fieldsToSelect.push(
              ...this._extractKeyFields(element as any).map(e => ({
                field: `${e.field}`
              }))
            );
          } else if (element.$$propertyName) {
            fieldsToSelect.push({
              field: element.$$propertyName
            });
          }
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
    this._baseSpec.addCriteria(predicate);
    this._baseSpec.applyFunction('COUNT', null);
    return Number.parseFloat(
      (await this.execute<{ COUNT: string }>(QueryType.RAW_ONE)).COUNT
    );
  }

  async sum(selector: SlimExpressionFunction<T, number>): Promise<number> {
    this._baseSpec.applyFunction('SUM', selector);
    return Number.parseFloat(
      (await this.execute<{ SUM: string }>(QueryType.RAW_ONE)).SUM
    );
  }

  async average(selector: SlimExpressionFunction<T, number>): Promise<number> {
    this._baseSpec.applyFunction('AVG', selector);
    return Number.parseFloat(
      (await this.execute<{ AVG: string }>(QueryType.RAW_ONE)).AVG
    );
  }

  async max<RT extends ExpressionResult>(
    selector: SlimExpressionFunction<T, RT>
  ): Promise<RT> {
    this._baseSpec.applyFunction('MAX', selector);
    return (await this.execute<{ MAX: RT }>(QueryType.RAW_ONE)).MAX;
  }
  async min<RT extends ExpressionResult>(
    selector: SlimExpressionFunction<T, RT>
  ): Promise<RT> {
    this._baseSpec.applyFunction('MIN', selector);
    return (await this.execute<{ MIN: RT }>(QueryType.RAW_ONE)).MIN;
  }

  orderBy(keySelector: SlimExpressionFunction<T>) {
    this._baseSpec.applyOrderBy(keySelector);
    return this as IQueryable<T, R, P>;
  }

  thenOrderBy(keySelector: SlimExpressionFunction<T>) {
    this._baseSpec.applyThenOrderBy(keySelector);
    return this as IQueryable<T, R, P>;
  }

  groupBy(keySelector: SlimExpressionFunction<T>) {
    this._baseSpec.applyGroupBy(keySelector);
    return this as IQueryable<T, R, P>;
  }

  thenGroupBy(keySelector: SlimExpressionFunction<T>) {
    this._baseSpec.applyThenGroupBy(keySelector);
    return this as IQueryable<T, R, P>;
  }

  orderByDescending(keySelector: SlimExpressionFunction<T>) {
    this._baseSpec.applyOrderByDescending(keySelector);
    return this as IQueryable<T, R, P>;
  }

  asSpecification(): ISpecification<T> {
    return this._baseSpec;
  }

  ignoreQueryFilters(): IQueryable<T, R, P> {
    this._ignoreFilters = true;
    return this as IQueryable<T, R, P>;
  }
  distinct() {
    this._baseSpec.applyDistinct();
    return this;
  }

  fromSpecification(spec: ISpecification<T>): IQueryable<T, T> {
    this._baseSpec.extend(spec);
    this._baseSpec.applySelector(spec.getSelector());
    this._baseSpec.applyOrderBy(spec.getOrderBy());
    this._baseSpec.applyOrderByDescending(spec.getOrderByDescending());
    return this as any;
  }

  toList(): Promise<T[]> {
    return this.execute(this._queryTypeToExecute);
  }

  private async execute<TResult>(type: QueryType): Promise<TResult> {
    try {
      if (!this._onGoingPromise || (await this._onGoingPromise)) {
        const res = await this.context.execute<T, TResult>(
          this as any,
          type,
          this._ignoreFilters
        );
        this._baseSpec.clearSpecs();
        return res;
      }
    } catch (err) {
      // wrapping this in finally, to clear specs on failure or success
      this._baseSpec.clearSpecs();
      throw err;
    }
  }
}
