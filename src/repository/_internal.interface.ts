import { ExpressionResult } from 'slim-exp';
import { ISpecification } from '../specification/specification.interface';
import { IDbSet, IQueryable } from './interfaces';

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends (infer U)[] ? DeepPartial<U>[] : T[P] extends ReadonlyArray<infer U> ? ReadonlyArray<DeepPartial<U>> : DeepPartial<T[P]>;
};

export interface IInternalDbSet<
  T extends object,
  P extends ExpressionResult = any
  > extends IDbSet<T, P> {
  asSpecification(): ISpecification<T>;
  fromSpecification(spec: ISpecification<T>): IQueryable<T, P>;
}
