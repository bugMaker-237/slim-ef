import { SlimExpressionFunction } from 'slim-exp';

export interface CriteriaExpression<
  T,
  S extends object = any,
  C extends object = any
> {
  func: SlimExpressionFunction<T, S, C>;
  context?: C;
}

export interface FieldsSelector<T, R extends object = any> {
  fieldsToSelect?: {
    field: string;
    // alias: string;
  }[];
  builder?: SlimExpressionFunction<T, R, any>;
}

export interface ISpecification<T = undefined> {
  getIncludePaths(): string[];
  getIncludes(): SlimExpressionFunction<T>[];
  getDistinct(): boolean;
  getCriterias(): CriteriaExpression<T>[];
  getChainedIncludes(): {
    initial: SlimExpressionFunction<T>;
    chain: SlimExpressionFunction<any, any>[];
  }[];

  getOrderBy(): SlimExpressionFunction<T> | null;
  getGroupBy(): SlimExpressionFunction<T> | null;
  getFunction():
    | {
        type: FunctionQueryType;
        func: SlimExpressionFunction<T>;
      }
    | null;
  getOrderByDescending(): SlimExpressionFunction<T> | null;
  getThenGroupBy(): SlimExpressionFunction<T>[];
  getThenOrderBy(): SlimExpressionFunction<T>[];
  getTake(): number;
  getSkip(): number;
  getIsPagingEnabled(): boolean;
  getSelector<R extends object = any>(): FieldsSelector<T, R> | null;
}
export enum QueryType {
  ONE,
  ALL,
  RAW_ONE,
  RAW_ALL
}
export type FunctionQueryType = 'SUM' | 'COUNT' | 'MIN' | 'MAX' | 'AVG';
export type QuerySpecificationEvaluatorConstructor<T = any> = new (
  initialQuery: (alias: string) => any,
  spec: ISpecification<T>
) => IQuerySpecificationEvaluator<T>;

export declare class IQuerySpecificationEvaluator<T = any> {
  constructor(initialQuery: (alias: string) => any, spec: ISpecification<T>);
  executeQuery<R = T, Q = R[]>(type: QueryType): Promise<Q>;
  getQuery(): Promise<string> | string;
  getParams(): Promise<any> | any;
}
