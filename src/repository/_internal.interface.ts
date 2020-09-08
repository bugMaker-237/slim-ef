import { ExpressionResult } from 'slim-exp';
import { ISpecification } from '../specification/specification.interface';
import { IDbSet, IQueryable } from './interfaces';

export interface IInternalDbSet<
  T extends object,
  P extends ExpressionResult = any
> extends IDbSet<T, P> {
  asSpecification(): ISpecification<T>;
  fromSpecification(spec: ISpecification<T>): IQueryable<T, P>;
}
