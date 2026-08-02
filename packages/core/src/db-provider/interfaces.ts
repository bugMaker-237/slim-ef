/**
 * Abstraction over a database transaction runner.
 * TypeORM's `QueryRunner` is structurally compatible with this interface.
 */
export interface IQueryRunner {
  isReleased: boolean;
  isTransactionActive: boolean;
  startTransaction(): Promise<void>;
  commitTransaction(): Promise<void>;
  rollbackTransaction(): Promise<void>;
  release(): Promise<void>;
}

/**
 * Abstraction over a repository for a single entity type.
 * TypeORM's `Repository<T>` is structurally compatible with this interface.
 */
export interface IDbRepository<T> {
  findOne(id: any): Promise<T | null>;
  save(entity: T): Promise<T>;
  delete(entity: T): Promise<boolean>;
  createQueryBuilder(alias: string): any;
}

/** Minimal column metadata needed by the proxy metadata builder. */
export interface IEntityColumnMetadata {
  propertyName: string;
  type: any;
}

/** Minimal relation metadata needed by the proxy metadata builder. */
export interface IEntityRelationMetadata {
  propertyName: string;
  type: Function;
  isOneToMany: boolean;
}

/** Minimal entity metadata needed by the proxy metadata builder. */
export interface IEntityMetadata {
  columns: ReadonlyArray<IEntityColumnMetadata>;
  relations: ReadonlyArray<IEntityRelationMetadata>;
}

/** Abstraction over the entity manager (preload support). */
export interface IEntityManager {
  preload<T>(type: new (...args: any[]) => T, entity: any): Promise<T>;
}

/**
 * Abstraction over a database connection provider.
 * TypeORM's `Connection` is structurally compatible with this interface,
 * so existing code that constructs `new Connection({...})` can be passed
 * directly to `DbContext` without any wrapper.
 */
export interface IDbConnectionAdapter {
  readonly isConnected: boolean;
  connect(): Promise<void>;
  close(): Promise<void>;
  createQueryRunner(): IQueryRunner;
  getRepository<T>(schema: any): IDbRepository<T>;
  query(query: string, parameters: any[]): Promise<any>;
  readonly manager: IEntityManager;
  getMetadata(type: any): IEntityMetadata;
}
