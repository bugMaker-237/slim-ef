import { SlimExpression } from 'slim-exp';
import { IQueryable, QueryRefiner } from '../repository/interfaces';
import { ISpecification } from './specification.interface';

const nameof = SlimExpression.nameOf;

export function isSpecification<T>(
  obj: ISpecification<T> | any
): obj is ISpecification<T> {
  return (
    nameof<ISpecification<T>>(s => s.getCriterias) in obj &&
    nameof<ISpecification<T>>(s => s.getIncludes) in obj &&
    nameof<ISpecification<T>>(s => s.getIsPagingEnabled) in obj &&
    nameof<ISpecification<T>>(s => s.getOrderBy) in obj &&
    nameof<ISpecification<T>>(s => s.getOrderByDescending) in obj &&
    nameof<ISpecification<T>>(s => s.getSelector) in obj &&
    nameof<ISpecification<T>>(s => s.getSkip) in obj &&
    nameof<ISpecification<T>>(s => s.getTake) in obj
  );
}

export function isQueryable<T extends object>(
  obj: any
): obj is QueryRefiner<T> {
  const props = [
    nameof<IQueryable<T, T>>(s => s.include),
    nameof<IQueryable<T, T>>(s => s.orderBy),
    nameof<IQueryable<T, T>>(s => s.orderByDescending),
    nameof<IQueryable<T, T>>(s => s.select),
    nameof<IQueryable<T, T>>(s => s.thenOrderBy),
    nameof<IQueryable<T, T>>(s => s.where)
  ];
  const content: string = obj.toString();

  return props.some(p => content.includes(`.${p}(`));
}

export const SQLConstants = {
  FALSE: 'FALSE',
  TRUE: 'TRUE'
};
export const SQLStringFunctions = {
  startsWith: "LOWER({0}) LIKE LOWER('{1}%')",
  endsWith: "LOWER({0}) LIKE LOWER('%{1}')",
  includes: "LOWER({0}) LIKE LOWER('%{1}%')",
  toLowerCase: 'LOWER({0})',
  toUpperCase: 'UPPER({0})'
};

export const SQLArrayFunctions = {
  includes: '{0} IN ({1})'
};

export const SQLJoinFunctions = {
  some: 'some'
};
export const ComparisonOperators = {
  ALL: ['==', '===', '>=', '<=', '!=', '!==', '<', '>'],
  EQUAL_TO: '==',
  STRICTLY_EQUAL_TO: '===',
  GREATER_THAN_OR_EQUAL: '>=',
  GREATER_THAN: '>',
  LESS_THAN_OR_EQUAL: '<=',
  LESS_THAN: '<',
  NOT_EQUAL_TO: '!=',
  STRICTLY_NOT_EQUAL_TO: '!=='
};

export function convertToSqlComparisonOperator(op: string, val?: any) {
  let res = '' + op;

  if (
    res === ComparisonOperators.EQUAL_TO ||
    res === ComparisonOperators.STRICTLY_EQUAL_TO
  )
    res = val === null ? 'is' : '=';
  else if (res === ComparisonOperators.STRICTLY_NOT_EQUAL_TO)
    res = val === null ? 'is not' : exports.ComparisonOperators.NOT_EQUAL_TO;

  return res;
}

export function format(toFormat: string, ...args: string[]) {
  return toFormat.replace(/{(\d+)}/g, (match, n) =>
    typeof args[n] !== 'undefined' ? args[n] : match
  );
}
