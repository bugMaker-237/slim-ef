import { SelectQueryBuilder } from 'typeorm';
import { IDbSet } from '../repository';

export type IUnitOfWork = IDbContext;
export interface IDbContext {
  /**
   * Begins tracking the given entity, and any other reachable entities that are not
   * already being tracked, in the Added state such that they will be inserted
   * into the database when `saveChanges()` is called.
   * @param entities
   */
  add<T>(...entities: T[]): Promise<void> | void;

  /**
   * Begins tracking the given entity and entries reachable from the given entity using
   * the Modified state by default such that they will be updated
   * in the database when `saveChanges()` is called.
   * @param entities
   */
  update<T>(...entities: T[]): Promise<void> | void;

  /**
   * Begins tracking the given entity in the Deleted state such that it will be removed
   * from the database when `saveChanges()` is called.
   * @param entities
   */
  remove<T>(...entities: T[]): Promise<void> | void;

  /**
   * Removes entities from the list of currently tracked entities
   * @param entities
   */
  unTrack<T>(...entities: T[]): Promise<void> | void;
  /**
   * Finds an entity with the given primary key values. If an entity with the given
   * primary key values is being tracked by the context, then it is returned
   * immediately without making a request to the database. Otherwise, a query is made
   * to the database for an entity with the given primary key values and this entity,
   * if found, is attached to the context and returned. If no entity is found, then
   * undefined is returned.
   * @param type The entity type
   * @param id The entity id
   */
  find<T>(type: new (...args: any) => T, id: any): Promise<T> | T;
  /**
   * Creates a database connextion and executes the given query
   * @param query
   * @param parameters
   */
  query(query: string, parameters: any[]): Promise<any>;

  /**
   * Discard all they tracked modifications of all entity types or a specific type
   * @param entityType
   */
  rollback(entityType: any | undefined): void;
  /**
   * Creates a DbSet<TEntity> that can be used to query and save instances of TEntity.
   * @param type
   */
  set<T extends object>(type: new (...args: any) => T): IDbSet<T, T>;

  /**
   * Saves all changes made in this context to the database.
   * This method will automatically call DetectChanges() to discover any changes to
   * entity instances before saving to the underlying database.
   */
  saveChanges(withoutRefresh?: boolean): Promise<ISavedTransaction>;
  /**
   * Releases the allocated resources for this context.
   */
  dispose(): void;

  /**
   * Starts transaction.
   */
  openTransaction(): Promise<void>;

  /**
   * Commits transaction.
   */
  commitTransaction(): Promise<void>;

  /**
   * Ends transaction.
   */
  rollbackTransaction(): Promise<void>;

  /**
   * Returns true if user-defined transaction is initialise
   */
  transactionIsOpen(): boolean;

  /**
   * Creates a new entity from the given plain javascript object. If the entity already exist in the database, then it loads it (and everything related to it), replaces all values with the new ones from the given object, and returns the new entity. The new entity is actually loaded from the database entity with all properties replaced from the new object.
   * @param type The type of the enity to load
   * @param entity The partial entity values
   */
  loadRelatedData<T>(type: new (...args: []) => T, entity: T): Promise<T>;
}

export type QueryInitializer<T> = (alias: string) => SelectQueryBuilder<T>;

export interface ISavedTransaction {
  added: any[];
  updated: any[];
  deleted: any[];
}
export interface ILogger {
  log<TState>(
    logLevel: 'error' | 'warning' | 'info',
    state: TState,
    exception?: Error
  ): void;
}
export type ILoggerCategoryName = 'config' | 'query';
export interface ILoggerFactory {
  createLogger: (categoryName: ILoggerCategoryName) => ILogger;
}

export interface IDbContextOptionsBuilder {
  useLoggerFactory(loggerFactory: ILoggerFactory): this;
  enableSensitiveLogging(enabled: boolean): this;
}
