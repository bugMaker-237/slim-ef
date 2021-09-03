import { IDbSet } from '../repository';
import { QueryType } from '../specification/specification.interface';
import {
  SelectArrayProxy,
  SelectBooleanProxy,
  SelectNumberProxy,
  SelectStringProxy
} from './metadata-proxy';

export interface IInternalDbContext {
  execute<T extends object, R = T[]>(
    queryable: IDbSet<T, T>,
    type: QueryType,
    ignoreFilters?: boolean
  ): Promise<R>;
  getMetadata<T>(
    type: new (...args) => T,
    includePaths: string[]
  ): Promise<ProxyMetaDataInstance<T>>;
  loadRelatedData<T>(type: new (...args: []) => T, entity: T): Promise<T>;
}

export type ProxyMetaDataInstance<T> = {
  [x in keyof T]: (
    | SelectBooleanProxy
    | SelectStringProxy
    | SelectNumberProxy
    | SelectArrayProxy
  ) & {
    $$propertyName: string;
    $$parentPropertyNames: string[];
  };
};
