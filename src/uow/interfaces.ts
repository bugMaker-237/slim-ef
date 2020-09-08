import { SelectQueryBuilder } from 'typeorm';
import { IDbSet } from '../repository';
import { DbSet } from '../repository/db-set';
import { QueryType } from '../specification/specification.interface';

export interface IDbContext {
  add<T>(...entities: T[]): Promise<void> | void;
  attach<T>(...entities: T[]): Promise<void> | void;
  remove<T>(...entities: T[]): Promise<void> | void;
  detach<T>(...entities: T[]): Promise<void> | void;
  find<T>(type: any, id: any): Promise<T> | T;
  execute<T extends object, R = T[]>(
    queryable: IDbSet<T>,
    type: QueryType,
    ignoreFilters?: boolean
  ): Promise<R>;
  saveChanges(): void;
}

export type QueryInitializer<T> = (alias: string) => SelectQueryBuilder<T>;

export interface ISavedTransaction {
  added: any[];
  updated: any[];
  deleted: any[];
}
