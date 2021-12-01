import {
  ExpressionResult,
  SlimExpression,
  SlimExpressionFunction
} from 'slim-exp';
import {
  ISpecification,
  FieldsSelector,
  CriteriaExpression,
  FunctionQueryType
} from './specification.interface';

export class BaseSpecification<T extends object> implements ISpecification<T> {
  private _includes: SlimExpressionFunction<T>[] = [];
  private _distinct: boolean = false;
  private _chainedIncludes: {
    initial: SlimExpressionFunction<T>;
    chain: SlimExpressionFunction<any, any>[];
  }[] = [];
  private _criterias: CriteriaExpression<T>[] = [];
  private _orderBy: SlimExpressionFunction<T>;
  private _groupBy: SlimExpressionFunction<T, any, any>;
  private _orderByDescending: SlimExpressionFunction<T>;
  private _thenOrderBy: SlimExpressionFunction<T>[] = [];
  private _thenGroupBy: SlimExpressionFunction<T, any, any>[] = [];
  private _take = 0;
  private _skip = 0;
  private _isPagingEnabled: boolean;
  private _selector: FieldsSelector<T>;
  private _func: {
    type: FunctionQueryType;
    func: SlimExpressionFunction<T>;
  };
  private _initializeThenInclude: boolean;

  getIncludePaths(): string[] {
    const paths = this._includes.map(i => SlimExpression.nameOf(i));

    const chainedPaths = this._chainedIncludes.map(ci => {
      const nameOfInititial = SlimExpression.nameOf(ci.initial);
      return ci.chain.reduce(
        (p, c) => (p.push(`${p[p.length - 1]}.${SlimExpression.nameOf(c)}`), p),
        [nameOfInititial]
      );
    });
    paths.push(...chainedPaths.reduce((p, c) => (p.push(...c), p), []));
    return paths;
  }
  getIncludes(): SlimExpressionFunction<T>[] {
    return this._includes;
  }
  getDistinct(): boolean {
    return this._distinct;
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
  getGroupBy(): SlimExpressionFunction<T> {
    return this._groupBy;
  }
  getOrderByDescending(): SlimExpressionFunction<T> {
    return this._orderByDescending;
  }
  getThenOrderBy(): SlimExpressionFunction<T>[] {
    return this._thenOrderBy;
  }
  getThenGroupBy(): SlimExpressionFunction<T>[] {
    return this._thenGroupBy;
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

  applyPaging(skip: number, take: number) {
    this._skip = skip;
    this._take = take;
    this._isPagingEnabled = true;
  }
  addInclude(include: SlimExpressionFunction<T>) {
    if (include) {
      this._includes.push(include);
      this._initializeThenInclude = true;
    }
  }
  applyDistinct(distinct = true) {
    this._distinct = distinct;
  }

  addChainedInclude<S extends object>(
    include: SlimExpressionFunction<T, S>,
    include2: SlimExpressionFunction<S>
  );
  addChainedInclude<S extends object, R extends object>(
    include: SlimExpressionFunction<T, S>,
    include2: SlimExpressionFunction<S, R>,
    include3: SlimExpressionFunction<R>
  );
  addChainedInclude<S extends object, R extends object, P extends object>(
    include: SlimExpressionFunction<T, S>,
    include2: SlimExpressionFunction<S, R>,
    include3: SlimExpressionFunction<R, P>,
    include4: SlimExpressionFunction<P>
  );
  addChainedInclude<
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

    const lastIndex = this._chainedIncludes
      .map(val => val.initial.toString().trim())
      .lastIndexOf(include.toString().trim());
    const i = this._chainedIncludes[lastIndex];

    if (i && !this._initializeThenInclude) {
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
      this._initializeThenInclude = false;
    }
  }

  addCriteria<C extends object, S extends ExpressionResult>(
    func: SlimExpressionFunction<T, S, C>,
    context?: C | null
  ) {
    if (func) this._criterias.push({ func, context });
  }
  applySelector(selector: FieldsSelector<T>) {
    if (selector) this._selector = selector;
  }
  applyOrderBy(orderBy: SlimExpressionFunction<T>) {
    this._orderBy = orderBy;
    this._orderByDescending = null;
  }
  applyGroupBy(groupBy: SlimExpressionFunction<T>) {
    this._groupBy = groupBy;
  }
  applyFunction(type: FunctionQueryType, func: SlimExpressionFunction<T>) {
    if (type)
      this._func = {
        type,
        func
      };
  }
  applyThenOrderBy(thenOrderBy: SlimExpressionFunction<T>) {
    if (thenOrderBy) {
      this._thenOrderBy.push(thenOrderBy);
    }
  }
  applyThenGroupBy(thenBy: SlimExpressionFunction<T>) {
    if (thenBy) {
      this._thenGroupBy.push(thenBy);
    }
  }
  applyOrderByDescending(orderBy: SlimExpressionFunction<T>) {
    this._orderByDescending = orderBy;
    this._orderBy = null;
  }
  extend(spec: ISpecification<T>) {
    this._includes.concat(spec.getIncludes());
    this._distinct = spec.getDistinct();
    this._chainedIncludes.concat(spec.getChainedIncludes());
    this._criterias.concat(spec.getCriterias());
    this._skip = spec.getSkip();
    this._take = spec.getTake();
    this._isPagingEnabled = spec.getIsPagingEnabled();
  }

  clearSpecs() {
    this._includes = [];
    this._distinct = false;
    this._chainedIncludes = [];
    this._criterias = [];
    this._func = null;
    this._isPagingEnabled = false;
    this._orderBy = null;
    this._orderByDescending = null;
    this._selector = null;
    this._skip = 0;
    this._take = 0;
    this._thenOrderBy = [];
    this._thenGroupBy = [];
  }
}
