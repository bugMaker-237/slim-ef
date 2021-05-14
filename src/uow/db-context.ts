import { Connection, QueryRunner, Repository } from 'typeorm';
import { getEntitySchema, getEntitySet, getEntitySetKeys } from '../repository';
import { DbSet, UnderlyingType } from '../repository/db-set';
import { IDbSet, IQueryable } from '../repository/interfaces';
import { DeepPartial, IInternalDbSet } from '../repository/_internal.interface';
import {
  QuerySpecificationEvaluatorConstructor,
  QueryType
} from '../specification/specification.interface';
import {
  ISavedTransaction,
  IDbContext,
  QueryInitializer,
  IDbContextOptionsBuilder
} from './interfaces';
import { getMetaData } from './metadata';
import { DbContextModelBuilder } from './model-builder';
import { DbContextOptionsBuilder } from './options-builder';
import {
  IInternalDbContext,
  ProxyMetaDataInstance
} from './_internal.interface';
interface IEntity {
  id?: any;
}

export abstract class DbContext implements IDbContext, IInternalDbContext {
  private _entitySets: WeakMap<any, Repository<any>>;
  private _new: IEntity[] = [];
  private _dirty: IEntity[] = [];
  private _deleted: IEntity[] = [];
  private _queryRunner: QueryRunner;
  private _modelBuilder: DbContextModelBuilder<any>;
  private _optionsBuilder: DbContextOptionsBuilder;

  constructor(
    protected _connection: Connection,
    protected evaluator: QuerySpecificationEvaluatorConstructor
  ) {
    this._entitySets = new WeakMap();
    this._modelBuilder = new DbContextModelBuilder();
    this._optionsBuilder = new DbContextOptionsBuilder();
    this._initialise();
  }

  private _initialise() {
    this._setUnderlyingEntityType();
    this.onModelCreation(this._modelBuilder);
    this.onConfiguring(this._optionsBuilder);
  }

  protected abstract onModelCreation<BaseType extends object = any>(
    builder: DbContextModelBuilder<BaseType>
  ): void;

  protected abstract onConfiguring(
    optionsBuilder: IDbContextOptionsBuilder
  ): void;

  public set<T extends object>(type: new (...args: any) => T): IDbSet<T, T> {
    const dbSet = new DbSet<T, T>(this);
    dbSet[UnderlyingType] = type;
    return dbSet as any;
  }

  public add<T extends IEntity>(...entities: T[]) {
    this._new.push(...this._throwIfNullFound(entities, 'add'));
  }

  public unTrack<T extends IEntity>(entity: T) {
    this._new = [...this._new.filter(n => n !== entity)];
    this._dirty = [...this._dirty.filter(n => n !== entity)];
    this._deleted = [...this._deleted.filter(n => n !== entity)];
  }

  public update<T extends IEntity>(...entities: T[]) {
    this._dirty.push(...this._throwIfNullFound(entities, 'attach'));
  }

  public remove<T extends IEntity>(...entities: T[]) {
    this._deleted.push(...this._throwIfNullFound(entities, 'remove'));
  }

  private _throwIfNullFound<T extends IEntity>(
    entities: T[],
    method: string
  ): T[] {
    if (entities.some(e => !e)) {
      throw new Error('Entities can not be null when call ' + method);
    }
    return entities;
  }

  public async find<T extends IEntity>(type: any, id: any): Promise<T> {
    await this._tryOpenConnection();
    const repo = this._getRepository(type);
    if (repo) {
      return (await repo.findOne(id)) as T;
    }
    return void 0;
  }

  public rollback(entityType: any = null): void {
    if (entityType !== null) {
      const type = typeof entityType;
      this._new = [...this._new.filter(n => typeof n !== type)];
      this._dirty = [...this._dirty.filter(n => typeof n === type)];
      this._deleted = [...this._deleted.filter(n => typeof n === type)];
    } else {
      this._dispose();
    }
  }

  public async saveChanges(): Promise<ISavedTransaction>;
  public async saveChanges(withoutRefresh = false): Promise<ISavedTransaction> {
    await this._tryOpenConnection();
    this._queryRunner = this._connection.createQueryRunner();
    await this._queryRunner.startTransaction();
    try {
      const added = await this._commitNew();
      const toUpdate = await this._commitDirty();
      const deleted = await this._commitDeleted();
      await this._queryRunner.commitTransaction();
      const updated = withoutRefresh
        ? toUpdate
        : await this._getUpdates(toUpdate);
      return { added, updated, deleted };
    } catch (e) {
      if (this._queryRunner.isTransactionActive)
        await this._queryRunner.rollbackTransaction();
      throw e;
    } finally {
      if (!this._queryRunner.isReleased) this._queryRunner.release();
      this._dispose();
    }
  }

  public async query(query: string, parameters: any[]): Promise<any> {
    return this._connection.query(query, parameters);
  }

  //#region IInternalDbContext Implementation
  public async execute<T extends object, R = T[]>(
    queryable: IInternalDbSet<T>,
    type: QueryType = QueryType.ALL,
    ignoreFilters = false
  ): Promise<R> {
    await this._tryOpenConnection();

    if (!ignoreFilters) {
      // applying filters
      const filters = this._modelBuilder.getFilters(queryable[UnderlyingType]);
      filters.forEach(f => {
        f(queryable);
      });
    }

    const initializer = this._getSQLBuilder(queryable);
    const specEval = new this.evaluator(
      initializer,
      queryable.asSpecification()
    );
    const logger = this._optionsBuilder.createLogger('query');
    logger?.log('info', await specEval.getQuery());
    return await specEval.executeQuery(type);
  }

  public async getMetadata<T>(
    type: new (...args: any[]) => T
  ): Promise<ProxyMetaDataInstance<T>> {
    await this._tryOpenConnection();
    return getMetaData(this._connection, type);
  }

  //#endregion
  public dispose(): void {
    this._dispose();
    this._connection.close();
  }

  //#region Private methods
  private async _tryOpenConnection() {
    if (!this._connection.isConnected) await this._connection.connect();
  }

  private _dispose() {
    this._new = [];
    this._dirty = [];
    this._deleted = [];
  }

  private _setUnderlyingEntityType() {
    const underType: string[] = getEntitySetKeys(this);
    if (underType) {
      for (const t of underType) {
        const dbset = new DbSet<any, any>(this);
        const entity = getEntitySet(this, t);

        if (dbset && entity) {
          Object.defineProperty(this, t, {
            configurable: false,
            enumerable: false,
            value: dbset,
            writable: false
          });
          dbset[UnderlyingType] = entity;
        }
      }
    }
  }

  private async _getUpdates(toUpdate: IEntity[]): Promise<IEntity[]> {
    const updated = [];
    for (const n of toUpdate) {
      const repo = this._getRepository<IEntity>(n);
      updated.push(await repo.findOne(n.id));
    }
    return updated;
  }

  private async _commitDeleted(): Promise<boolean[]> {
    const deleted = [];
    for (const n of this._deleted) {
      const repo = this._getRepository<IEntity>(n);
      deleted.push(await repo.delete(n));
    }
    return deleted;
  }

  private async _commitDirty(): Promise<IEntity[]> {
    return await this._commitDirtyAll(this._dirty);
  }

  private async _commitDirtyAll(dirty: IEntity[]): Promise<IEntity[]> {
    const updated = [];
    for (const n of dirty) {
      const repo = this._getRepository<IEntity>(n);
      updated.push(await repo.save(n));
    }
    return updated;
  }

  private async _commitNew(): Promise<IEntity[]> {
    const added = [];
    for (const n of this._new) {
      const repo = this._getRepository<IEntity>(n);
      added.push(await repo.save(n));
    }
    return added;
  }

  private _getSQLBuilder<T extends object>(
    type: IDbSet<T, T>
  ): QueryInitializer<T> {
    const repo = this._getRepository(type);
    const initializer = (alias: string) => repo.createQueryBuilder(alias);

    return initializer as QueryInitializer<T>;
  }

  private _getRepository<T>(type: any): Repository<T> {
    if (type instanceof DbSet) {
      type = type[UnderlyingType];
    }
    const schema = getEntitySchema(type);

    if (this._entitySets.has(type)) return this._entitySets.get(type);
    if (!schema)
      throw new Error(
        'Schema not found. You may not have set EntityRepository decorator correctly'
      );
    const repo = this._connection.getRepository<any>(schema);
    this._entitySets.set(type, repo);

    return repo;
  }
  //#endregion
}

// tslint:disable-next-line: max-classes-per-file
export abstract class UnitOfWork extends DbContext
  implements Omit<Omit<DbContext, 'execute'>, 'getMetadata'> {}
