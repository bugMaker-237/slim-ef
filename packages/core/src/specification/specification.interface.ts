import { SlimExpressionFunction } from 'slim-exp';

/**
 * A single predicate (and its external context) that constrains a query's
 * result set. The `func` is a string-literal-free expression, optionally
 * referencing values from `context`.
 */
export interface CriteriaExpression<
  T,
  S extends object = any,
  C extends object = any
> {
  /** The LINQ predicate expression (e.g. `p => p.age < $.maxAge`). */
  func: SlimExpressionFunction<T, S, C>;

  /** External values referenced by `func` through the `$` marker. */
  context?: C;
}

/**
 * Describes the columns a `select()` projection must fetch and the builder used
 * to assemble the projected result type.
 */
export interface FieldsSelector<T, R extends object = any> {
  /** The `property.path` of each field to select (inclusive of nested relations). */
  fieldsToSelect?: {
    field: string;
    // alias: string;
  }[];

  /** The original selector function used to project rows into the result type. */
  builder?: SlimExpressionFunction<T, R, any>;
}

/**
 * Immutable description of a single query: its includes, conditions, ordering,
 * paging, grouping and projections. A `BaseSpecification` implements this
 * interface and is consumed by query specification evaluators that translate it
 * into concrete SQL.
 */
export interface ISpecification<T = undefined> {
  /**
   * The flattened navigation paths to include (e.g. `['trip', 'trip.agency']`):
   * a mix of direct includes and chained (`thenInclude`) paths.
   */
  getIncludePaths(): string[];

  /** The direct `include(...)` navigation expressions (without chained paths). */
  getIncludes(): SlimExpressionFunction<T>[];

  /** Whether the query must return distinct rows. */
  getDistinct(): boolean;

  /** The collection of predicates that filter the query result. */
  getCriterias(): CriteriaExpression<T>[];

  /**
   * The chained includes, grouped by their initial navigation property. Each
   * entry holds the root `initial` include and the ordered list of subsequent
   * navigation expressions from `thenInclude(...)`.
   */
  getChainedIncludes(): {
    /** The initial (root) navigation property expression. */
    initial: SlimExpressionFunction<T>;
    /** The ordered chain of navigation expressions applied on top of `initial`. */
    chain: SlimExpressionFunction<any, any>[];
  }[];

  /** The primary ascending ordering expression, when one is set. */
  getOrderBy(): SlimExpressionFunction<T> | null;

  /** The primary grouping expression, when one is set. */
  getGroupBy(): SlimExpressionFunction<T> | null;

  /** The aggregate function (e.g. `SUM`, `COUNT`, `MIN`, `MAX`, `AVG`) to apply, when set. */
  getFunction(): {
    type: FunctionQueryType;
    func?: SlimExpressionFunction<T>;
  } | null;

  /** The primary descending ordering expression, when one is set. */
  getOrderByDescending(): SlimExpressionFunction<T> | null;

  /** The ordered list of secondary grouping expressions from `thenGroupBy(...)`. */
  getThenGroupBy(): SlimExpressionFunction<T>[];

  /** The ordered list of secondary ordering expressions from `thenOrderBy(...)`. */
  getThenOrderBy(): SlimExpressionFunction<T>[];

  /** The limit (`take`) applied to the query, or `0` when paging is disabled. */
  getTake(): number;

  /** The offset (`skip`) applied to the query, or `0` when paging is disabled. */
  getSkip(): number;

  /** Whether `skip`/`take` paging has been applied to the query. */
  getIsPagingEnabled(): boolean;

  /** The active select projection, when one is set. */
  getSelector<R extends object = any>(): FieldsSelector<T, R> | null;
}

/**
 * The cardinality/kind of result a query execution should return.
 */
export enum QueryType {
  /** Returns a single (first) entity. */
  ONE,
  /** Returns an array of entities. */
  ALL,
  /** Returns a single raw row. */
  RAW_ONE,
  /** Returns an array of raw rows. */
  RAW_ALL
}

/**
 * The aggregate functions the framework can apply to a projection.
 */
export type FunctionQueryType = 'SUM' | 'COUNT' | 'MIN' | 'MAX' | 'AVG';

/**
 * Constructor signature for a query specification evaluator. A concrete
 * evaluator turns a LINQ `ISpecification` and an initial query builder into a
 * database query.
 */
export type QuerySpecificationEvaluatorConstructor<T = any> = new (
  /** A factory that returns an aliased query builder for the root entity. */
  initialQuery: (alias: string) => any,
  /** The specification describing the query to build. */
  spec: ISpecification<T>
) => IQuerySpecificationEvaluator<T>;

/**
 * Contract implemented by query specification evaluators.
 *
 * Evaluators translate an `ISpecification` into an executable database query
 * (e.g. a TypeORM `SelectQueryBuilder`). Only the query string, its parameters
 * and the executed result are exposed to the framework.
 */
export declare class IQuerySpecificationEvaluator<T = any> {
  constructor(
    /** A query builder for the root entity, aliased by the framework. */
    initialQuery: (alias: string) => any,
    /** The specification describing the operation to build. */
    spec: ISpecification<T>
  );

  /**
   * Runs the query and returns the result shaped to the requested cardinality.
   * @param type Whether a single/array and raw/entity result is expected.
   */
  executeQuery<R = T, Q = R[]>(type: QueryType): Promise<Q>;

  /** Returns the generated SQL query string (may be async). */
  getQuery(): Promise<string> | string;

  /** Returns the SQL parameters bound to the generated query (may be async). */
  getParams(): Promise<any> | any;
}