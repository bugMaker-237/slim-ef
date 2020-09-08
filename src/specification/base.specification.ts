import { ExpressionResult, SlimExpressionFunction } from 'slim-exp';
import {
  ISpecification,
  FieldsSelector,
  CriteriaExpression,
  FunctionQueryType
} from './specification.interface';

export class BaseSpecification<T extends object> implements ISpecification<T> {
  private _includes: SlimExpressionFunction<T>[] = [];
  private _chainedIncludes: {
    initial: SlimExpressionFunction<T>;
    chain: SlimExpressionFunction<any, any>[];
  }[] = [];
  private _criterias: CriteriaExpression<T>[] = [];
  private _orderBy: SlimExpressionFunction<T>;
  private _orderByDescending: SlimExpressionFunction<T>;
  private _thenBy: SlimExpressionFunction<T>;
  private _take = 0;
  private _skip = 0;
  private _isPagingEnabled: boolean;
  private _selector: FieldsSelector<T>;
  private _func: {
    type: FunctionQueryType;
    func: SlimExpressionFunction<T>;
  };

  getIncludes(): SlimExpressionFunction<T>[] {
    return this._includes;
  }
  getFunction(): {
    type: FunctionQueryType;
    func: SlimExpressionFunction<T>;
  } {
    return this._func;
  }
  getChainedIncludes(): {
    initial: SlimExpressionFunction<T>;
    chain: SlimExpressionFunction<any, any>[];
  }[] {
    return this._chainedIncludes;
  }
  getCriterias(): CriteriaExpression<T>[] {
    return this._criterias;
  }
  getOrderBy(): SlimExpressionFunction<T> {
    return this._orderBy;
  }
  getOrderByDescending(): SlimExpressionFunction<T> {
    return this._orderByDescending;
  }
  getThenBy(): SlimExpressionFunction<T> {
    return this._thenBy;
  }
  getTake(): number {
    return this._take;
  }
  getSkip(): number {
    return this._skip;
  }
  getIsPagingEnabled(): boolean {
    return this._isPagingEnabled;
  }
  getSelector(): FieldsSelector<T> {
    return this._selector;
  }

  protected applyPaging(skip: number, take: number) {
    this._skip = skip;
    this._take = take;
    this._isPagingEnabled = true;
  }
  protected addInclude(include: SlimExpressionFunction<T>) {
    if (include) this._includes.push(include);
  }

  protected addChainedInclude<S extends object>(
    include: SlimExpressionFunction<T, S>,
    include2: SlimExpressionFunction<S>
  );
  protected addChainedInclude<S extends object, R extends object>(
    include: SlimExpressionFunction<T, S>,
    include2: SlimExpressionFunction<S, R>,
    include3: SlimExpressionFunction<R>
  );
  protected addChainedInclude<
    S extends object,
    R extends object,
    P extends object
  >(
    include: SlimExpressionFunction<T, S>,
    include2: SlimExpressionFunction<S, R>,
    include3: SlimExpressionFunction<R, P>,
    include4: SlimExpressionFunction<P>
  );
  protected addChainedInclude<
    S extends object,
    R extends object,
    P extends object,
    O extends object
  >(
    include: SlimExpressionFunction<T, S>,
    include2?: SlimExpressionFunction<S, R>,
    include3?: SlimExpressionFunction<R, P>,
    include4?: SlimExpressionFunction<P, O>,
    include5?: SlimExpressionFunction<O>
  ) {
    const chain = [];
    if (include2) chain.push(include2);
    if (include3) chain.push(include3);
    if (include4) chain.push(include4);
    if (include5) chain.push(include5);

    if (chain.length === 0) {
      this._includes.push(include);
      return;
    }

    this._includes = this._includes.filter(
      v => v.toString() !== include.toString()
    );

    const i = this._chainedIncludes.find(
      val => val.initial.toString() === include.toString()
    );
    if (i) {
      chain.forEach(c => {
        if (!i.chain.find(v => v.toString() === c.toString())) {
          i.chain.push(c);
        }
      });
    } else {
      this._chainedIncludes.push({
        initial: include,
        chain
      });
    }
  }

  protected addCriteria<C extends object, S extends ExpressionResult>(
    func: SlimExpressionFunction<T, S, C>,
    context?: C | null
  ) {
    if (func) this._criterias.push({ func, context });
  }
  protected applySelector(selector: FieldsSelector<T>) {
    if (selector) this._selector = selector;
  }
  protected applyExpressionSelectors(
    ...selectors: SlimExpressionFunction<T>[]
  ) {
    if (selectors)
      this._selector = {
        fieldsToSelect: selectors
      };
  }
  protected applyOrderBy(orderBy: SlimExpressionFunction<T>) {
    this._orderBy = orderBy;
  }
  protected applyFunction(
    type: FunctionQueryType,
    func: SlimExpressionFunction<T>
  ) {
    if (func)
      this._func = {
        type,
        func
      };
  }
  protected applyThenOrderBy(thenOrderBy: SlimExpressionFunction<T>) {
    this._orderByDescending = thenOrderBy;
  }
  protected applyOrderByDescending(orderBy: SlimExpressionFunction<T>) {
    this._orderByDescending = orderBy;
  }
  protected extend(spec: ISpecification<T>) {
    this._includes.concat(spec.getIncludes());
    this._chainedIncludes.concat(spec.getChainedIncludes());
    this._criterias.concat(spec.getCriterias());
    this._skip = spec.getSkip();
    this._take = spec.getTake();
    this._isPagingEnabled = spec.getIsPagingEnabled();
  }
}
