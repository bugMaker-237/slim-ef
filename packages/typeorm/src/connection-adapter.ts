import {
  IDbConnectionAdapter,
  IDbRepository,
  IEntityManager,
  IEntityMetadata,
  IQueryRunner
} from '@slim-ef/core';
import { DataSource, DataSourceOptions } from 'typeorm';

export class TypeOrmConnectionAdapter implements IDbConnectionAdapter {
  private _dataSource: DataSource;

  constructor(sourceOptions: DataSourceOptions) {
    this._dataSource = new DataSource(sourceOptions);
  }
  get isConnected(): boolean {
    return this._dataSource.isInitialized;
  }

  get manager(): IEntityManager {
    return this._dataSource.manager as IEntityManager;
  }

  async connect(): Promise<void> {
    await this._dataSource.initialize();
  }
  async close(): Promise<void> {
    await this._dataSource.destroy();
  }
  createQueryRunner(): IQueryRunner {
    const queryRunner = this._dataSource.createQueryRunner();
    return {
      get isReleased() {
        return queryRunner.isReleased;
      },
      get isTransactionActive() {
        return queryRunner.isTransactionActive;
      },
      startTransaction: () => queryRunner.startTransaction(),
      commitTransaction: () => queryRunner.commitTransaction(),
      rollbackTransaction: () => queryRunner.rollbackTransaction(),
      release: () => queryRunner.release()
    };
  }

  getRepository<T>(schema: any): IDbRepository<T> {
    const repository = this._dataSource.getRepository<any>(schema);
    return {
      findOne: (id: any) =>
        repository.findOne({
          where: { id }
        }),
      save: async (entity: T) => {
        const res = await repository.save(entity);
        return res;
      },
      delete: async (entity: any) =>
        !!(await repository.delete({
          id: entity.id
        })),
      createQueryBuilder: (alias: string) => {
        const qb = repository.createQueryBuilder(alias);
        return qb;
      }
    };
  }
  query(query: string, parameters: any[]): Promise<any> {
    return this._dataSource.query(query, parameters);
  }

  getMetadata(type: any): IEntityMetadata {
    const metadata = this._dataSource.getMetadata(type);
    return {
      columns: metadata.columns.map(col => ({
        propertyName: col.propertyName,
        type: col.type
      })),
      relations: metadata.relations.map(rel => ({
        propertyName: rel.propertyName,
        type: (rel.inverseEntityMetadata?.target ?? rel.type) as Function,
        isOneToMany: rel.isOneToMany
      }))
    };
  }
}
