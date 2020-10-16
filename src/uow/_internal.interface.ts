import { IDbSet } from "../repository";
import { QueryType } from "../specification/specification.interface";

export interface IInternalDbContext {
  execute<T extends object, R = T[]>(
    queryable: IDbSet<T>,
    type: QueryType,
    ignoreFilters?: boolean
  ): Promise<R>;
}
