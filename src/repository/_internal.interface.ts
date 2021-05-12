import { ISpecification } from '../specification/specification.interface';
import { IDbSet, IQueryable } from './interfaces';

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends (infer U)[]
    ? DeepPartial<U>[]
    : T[P] extends ReadonlyArray<infer U2>
    ? ReadonlyArray<DeepPartial<U2>>
    : DeepPartial<T[P]>;
};

export interface IInternalDbSet<T extends object> extends IDbSet<T, T> {
  asSpecification(): ISpecification<T>;
  fromSpecification(spec: ISpecification<T>): IQueryable<T, T>;
}
