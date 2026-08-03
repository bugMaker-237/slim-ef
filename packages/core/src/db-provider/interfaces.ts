/**
 * Abstraction over a database transaction runner.
 *
 * This interface is used by the {@link DbContext} to manage transactions
 * (open, commit, rollback) independently of the underlying ORM. TypeORM's
 * `QueryRunner` is structurally compatible with this interface, so it can be
 * wrapped or passed directly without further adaptation.
 */
export interface IQueryRunner {
  /** Whether the underlying query runner has been released and can no longer be used. */
  isReleased: boolean;

  /** Whether a transaction is currently active on the underlying runner. */
  isTransactionActive: boolean;

  /** Begins a new transaction on the underlying runner. */
  startTransaction(): Promise<void>;

  /** Commits the currently active transaction. */
  commitTransaction(): Promise<void>;

  /** Rolls back the currently active transaction, discarding any changes. */
  rollbackTransaction(): Promise<void>;

  /** Releases the underlying query runner and frees its resources. */
  release(): Promise<void>;
}

/**
 * Abstraction over a repository for a single entity type.
 *
 * Repositories expose the minimum operations the framework needs to read and
 * write entities in a store. TypeORM's `Repository<T>` is structurally
 * compatible with this interface.
 */
export interface IDbRepository<T> {
  /**
   * Finds a single entity by its primary key.
   * @param id The primary key value of the entity to find.
   * @returns The matching entity, or `null` when none exists.
   */
  findOne(id: any): Promise<T | null>;

  /**
   * Persists the given entity, inserting it when new or updating it when it
   * already exists.
   * @param entity The entity to save.
   * @returns The saved entity, including any generated values (e.g. ids).
   */
  save(entity: T): Promise<T>;

  /**
   * Deletes the given entity from the data store.
   * @param entity The entity to delete.
   * @returns Whether the deletion affected any row.
   */
  delete(entity: T): Promise<boolean>;

  /**
   * Creates an aliased query builder used to translate LINQ expressions into
   * database queries.
   * @param alias The alias to give the root entity.
   */
  createQueryBuilder(alias: string): any;
}

/**
 * Minimal column metadata needed by the proxy metadata builder.
 *
 * Describes a single persistent column of an entity so that select
 * projections can be resolved without string literals.
 */
export interface IEntityColumnMetadata {
  /** The property name of the column on the entity class. */
  propertyName: string;

  /** The runtime type of the column (e.g. `String`, `Number`, `Boolean`). */
  type: any;
}

/**
 * Minimal relation metadata needed by the proxy metadata builder.
 *
 * Describes a navigation property linking one entity to another entity.
 */
export interface IEntityRelationMetadata {
  /** The property name of the relation on the entity class. */
  propertyName: string;

  /** The constructor of the related entity type. */
  type: Function;

  /** Whether the relation is one-to-many (a collection) rather than a single reference. */
  isOneToMany: boolean;
}

/**
 * Minimal entity metadata needed by the proxy metadata builder.
 *
 * Groups the columns and relations of a single entity so that include/select
 * proxies can be constructed from the ORM's own metadata.
 */
export interface IEntityMetadata {
  /** The columns owned by the entity. */
  columns: ReadonlyArray<IEntityColumnMetadata>;

  /** The relations owned by the entity. */
  relations: ReadonlyArray<IEntityRelationMetadata>;
}

/**
 * Abstraction over the entity manager (preload support).
 *
 * Provides ORM-agnostic loading of a partial entity into a full one by primary key.
 */
export interface IEntityManager {
  /**
   * Loads an existing entity matching the given partial entity and merges the
   * partial values onto it.
   * @param type The entity constructor.
   * @param entity The partial entity containing at least a primary key.
   * @returns The fully loaded entity.
   */
  preload<T>(type: new (...args: any[]) => T, entity: any): Promise<T>;
}

/**
 * Abstraction over a database connection provider.
 *
 * Encapsulates connecting to a database, running queries, creating
 * transactions, and introspecting entity metadata. TypeORM's `Connection` is
 * structurally compatible with this interface, so existing code that constructs
 * `new Connection({...})` can be passed directly to `DbContext` without any
 * wrapper.
 */
export interface IDbConnectionAdapter {
  /** Whether the connection has been initialized and is ready to use. */
  readonly isConnected: boolean;

  /** Initializes/connects to the underlying data source. */
  connect(): Promise<void>;

  /** Destroys/closes the underlying data source if it is connected. */
  close(): Promise<void>;

  /** Creates a new transaction runner scoped to this connection. */
  createQueryRunner(): IQueryRunner;

  /**
   * Resolves a repository for a given entity schema.
   * @param schema The entity schema (or entity class) to create the repository for.
   */
  getRepository<T>(schema: any): IDbRepository<T>;

  /**
   * Executes a raw SQL query against the connection.
   * @param query The SQL statement to execute.
   * @param parameters The values to bind to the query's placeholders.
   * @returns The rows returned by the query.
   */
  query(query: string, parameters: any[]): Promise<any>;

  /** The entity manager for this connection (used for preload support). */
  readonly manager: IEntityManager;

  /**
   * Returns the minimal column/relation metadata for an entity type.
   * @param type The entity type (class or schema) to introspect.
   */
  getMetadata(type: any): IEntityMetadata;
}
