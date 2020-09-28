import { SlimExpressionFunction } from 'slim-exp';
import { SelectQueryBuilder } from 'typeorm';

export interface CriteriaExpression<
  T,
  S extends object = any,
  C extends object = any
> {
  func: SlimExpressionFunction<T, S, C>;
  context?: C;
}

export interface FieldsSelector<T> {
  fieldsToSelect?: SlimExpressionFunction<T>[];
  builder?: SlimExpressionFunction<T>;
}

export interface ISpecification<T = undefined> {
  getIncludes(): SlimExpressionFunction<T>[];
  getCriterias(): CriteriaExpression<T>[];
  getChainedIncludes(): {
    initial: SlimExpressionFunction<T>;
    chain: SlimExpressionFunction<any, any>[];
  }[];

  getOrderBy(): SlimExpressionFunction<T>;
  getFunction(): {
    type: FunctionQueryType;
    func: SlimExpressionFunction<T>;
  };
  getOrderByDescending(): SlimExpressionFunction<T>;
  getThenBy(): SlimExpressionFunction<T>;
  getTake(): number;
  getSkip(): number;
  getIsPagingEnabled(): boolean;
  getSelector(): FieldsSelector<T>;
}
export enum QueryType {
  ONE,
  ALL,
  RAW_ONE,
  RAW_ALL
}
export type FunctionQueryType = 'SUM' | 'COUNT' | 'MIN' | 'MAX' | 'AVG';
export type QuerySpecificationEvaluatorConstructor<T = any> = new (
  initialQuery: (alias: string) => SelectQueryBuilder<T>,
  spec: ISpecification<T>
) => IQuerySpecificationEvaluator<T>;
export declare class IQuerySpecificationEvaluator<T = any> {
  constructor(
    initialQuery: (alias: string) => SelectQueryBuilder<T>,
    spec: ISpecification<T>
  );
  executeQuery<R = T[]>(type: QueryType): Promise<R>;
  getQuery(): Promise<string> | string;
}
