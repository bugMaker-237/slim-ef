import { ExpressionResult, SlimExpressionFunction } from 'slim-exp';
import { BaseSpecification } from '../specification/base.specification';
import {
  FieldsSelector,
  ISpecification,
  QueryType
} from '../specification/specification.interface';
import { IDbContext, IUnitOfWork } from '../uow';
import {
  IInternalDbContext,
  ProxyMetaDataInstance
} from '../uow/_internal.interface';
import { DeepPartial } from './_internal.interface';
import { EmptySetException } from './exception';
import {
  EntityBase,
  IDbSet,
  Includable,
  IQueryable,
  IQueryableSelectionResult,
  Predicate,
  PredicateWithContext,
  UnderlyingType
} from './interfaces';
import { getEntitySchema } from './repository.decorator';
import { patchM } from './utilis';

export class DbSet<
  T extends EntityBase,
  R extends T | T[] = T,
  P = T,
  E extends T | DeepPartial<T> = T | DeepPartial<T>
> implements IDbSet<T, R, P, E> {
  private _queryTypeToExecute = QueryType.ALL;
  private _baseSpec = new BaseSpecification<T>();
  private _lastInclude?: SlimExpressionFunction<T>;
  private _currentSkip: number = 0;
  private _currentTake: number = 0;
  private _ignoreFilters?: boolean;
  private _underlyingType!: new (...args: any[]) => T;
  private _onGoingPromise?: Promise<boolean>;

  constructor(context: IDbContext | IUnitOfWork);
  constructor(
    public context: (IDbContext | IUnitOfWork) & IInternalDbContext
  ) {}

  get [UnderlyingType]() {
    if (!this._underlyingType) {
      this._underlyingType = getEntitySchema(this)! as any;
    }
    return this._underlyingType;
  }

  set [UnderlyingType](value) {
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

  async find(id: any): Promise<T | undefined> {
    return await this.context.find<T>(this[UnderlyingType], id);
  }

  async exists(id: any): Promise<boolean> {
    return !!(await this.find(id));
  }

  loadRelatedData(entity: T): Promise<T> {
    return this.context.loadRelatedData(this._underlyingType, entity);
  }

  async firstOrDefault(): Promise<T>;
  async firstOrDefault<C extends object>(predicate: Predicate<T>): Promise<T>;
  async firstOrDefault<C extends object>(
    predicate: Predicate<T>,
    context: C
  ): Promise<T>;
  async firstOrDefault<C extends object>(
    predicate?: Predicate<T>,
    context?: C
  ): Promise<T> {
    this._baseSpec.applyPaging(0, 1);
    this.where(predicate!, context!);
    return await this.execute<T>(QueryType.ONE);
  }

  async first(): Promise<T>;
  async first<C extends object>(predicate: Predicate<T>): Promise<T>;
  async first<C extends object>(
    predicate: Predicate<T>,
    context: C
  ): Promise<T>;
  async first<C extends object>(
    predicate?: Predicate<T>,
    context?: C
  ): Promise<T> {
    const elt = await this.firstOrDefault(predicate!, context!);
    if (elt === null || elt === undefined) throw new EmptySetException();

    return elt;
  }

  include<S extends object>(
    navigationPropertyPath: Predicate<T, Includable<S>>
  ) {
    this._lastInclude = navigationPropertyPath;
    this._baseSpec.addInclude(navigationPropertyPath);
    return this as unknown as IQueryable<T, R, S>;
  }
  thenInclude<S extends object>(
    navigationPropertyPath: Predicate<P, Includable<S>>
  ) {
    if (this._lastInclude)
      this._baseSpec.addChainedInclude(
        this._lastInclude,
        navigationPropertyPath
      );

    return this as unknown as IQueryable<T, R, S>;
  }

  where(predicate: Predicate<T>): IQueryable<T, R, P>;
  where<C extends object>(
    predicate: PredicateWithContext<T, C>,
    context: C
  ): IQueryable<T, R, P>;
  where<C extends object>(
    predicate?: Predicate<T> | PredicateWithContext<T, C>,
    context?: C
  ): IQueryable<T, R, P> {
    this._baseSpec.addCriteria(
      predicate as SlimExpressionFunction<T, any, C>,
      context
    );
    return this as unknown as IQueryable<T, R, P>;
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

  select<V extends object>(selector: Predicate<T, V>) {
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

    return this as unknown as IQueryableSelectionResult<V, R>;
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

  count(): Promise<number>;
  count(predicate: Predicate<T>): Promise<number>;
  count<C extends object>(
    predicate: PredicateWithContext<T, C>,
    context: C
  ): Promise<number>;
  async count<C extends object>(
    predicate?: Predicate<T> | PredicateWithContext<T, C>,
    context?: C
  ): Promise<number> {
    this._baseSpec.addCriteria(
      predicate as SlimExpressionFunction<T, any, C>,
      context
    );
    this._baseSpec.applyFunction('COUNT');
    return Number.parseFloat(
      (await this.execute<{ COUNT: string }>(QueryType.RAW_ONE)).COUNT
    );
  }

  async sum(selector: Predicate<T, number>): Promise<number> {
    this._baseSpec.applyFunction('SUM', selector);
    return Number.parseFloat(
      (await this.execute<{ SUM: string }>(QueryType.RAW_ONE)).SUM
    );
  }

  async average(selector: Predicate<T, number>): Promise<number> {
    this._baseSpec.applyFunction('AVG', selector);
    return Number.parseFloat(
      (await this.execute<{ AVG: string }>(QueryType.RAW_ONE)).AVG
    );
  }

  async max<RT extends ExpressionResult>(
    selector: Predicate<T, RT>
  ): Promise<RT> {
    this._baseSpec.applyFunction('MAX', selector);
    return (await this.execute<{ MAX: RT }>(QueryType.RAW_ONE)).MAX;
  }
  async min<RT extends ExpressionResult>(
    selector: Predicate<T, RT>
  ): Promise<RT> {
    this._baseSpec.applyFunction('MIN', selector);
    return (await this.execute<{ MIN: RT }>(QueryType.RAW_ONE)).MIN;
  }

  orderBy<O extends ExpressionResult>(keySelector: Predicate<T, O>) {
    this._baseSpec.applyOrderBy(keySelector);
    return this as IQueryable<T, R, P>;
  }

  thenOrderBy<O extends ExpressionResult>(keySelector: Predicate<T, O>) {
    this._baseSpec.applyThenOrderBy(keySelector);
    return this as IQueryable<T, R, P>;
  }

  groupBy<O extends ExpressionResult>(keySelector: Predicate<T, O>) {
    this._baseSpec.applyGroupBy(keySelector);
    return this as IQueryable<T, R, P>;
  }

  thenGroupBy<O extends ExpressionResult>(keySelector: Predicate<T, O>) {
    this._baseSpec.applyThenGroupBy(keySelector);
    return this as IQueryable<T, R, P>;
  }

  orderByDescending<O extends ExpressionResult>(keySelector: Predicate<T, O>) {
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
      return undefined as any;
    } catch (err) {
      // wrapping this in finally, to clear specs on failure or success
      this._baseSpec.clearSpecs();
      throw err;
    }
  }
}
