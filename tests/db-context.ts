import { resolve } from 'path';
import { Connection } from 'typeorm';
import { MysqlConnectionOptions } from 'typeorm/driver/mysql/MysqlConnectionOptions';
import { SqliteConnectionOptions } from 'typeorm/driver/sqlite/SqliteConnectionOptions';
import {
  DbContext,
  DbSet,
  DbSetEntity,
  IDbSet,
  SQLQuerySpecificationEvaluator
} from '../lib/index';
import { IDbContextOptionsBuilder } from '../lib/uow/interfaces';
import { DbContextModelBuilder } from '../lib/uow/model-builder';
import { Agency } from './entities/agency';
import { Person } from './entities/person';
import { Trip } from './entities/trip';

export class FakeDBContext extends DbContext {
  constructor() {
    /**
     * SQLite connection
     */
    super(
      new Connection({
        type: 'sqlite',
        database: resolve(__dirname, 'seeder', 'slim_ef_test.db'),
        entities: [Person, Agency, Trip],
        synchronize: false
      } as SqliteConnectionOptions),
      SQLQuerySpecificationEvaluator
    );
    /**
     * MySql Connection
     */
    // super(
    //   new Connection({
    //     type: 'mysql',
    //     host: 'localhost',
    //     port: 3306,
    //     username: 'admin',
    //     password: 'admin0000',
    //     database: 'slim_ef_test',
    //     entities: [Person, Agency, Trip],
    //     synchronize: true
    //   } as MysqlConnectionOptions),
    //   SQLQuerySpecificationEvaluator
    // );
  }

  protected onModelCreation<BaseType extends object = any>(
    builder: DbContextModelBuilder<BaseType>
  ): void {
    builder.entity(Person).hasQueryFilter(q => q.where(e => e.IDNumber > 50));
  }

  protected onConfiguring(optionsBuilder: IDbContextOptionsBuilder): void {
    optionsBuilder.useLoggerFactory({
      createLogger: (catName: string) => ({
        log: (level, state) => console.log({ catName, state, level })
      })
    });
  }

  @DbSetEntity(Person)
  public readonly persons: IDbSet<Person>;

  @DbSetEntity(Agency)
  public readonly agencies: IDbSet<Agency>;

  @DbSetEntity(Trip)
  public readonly trips: IDbSet<Trip>;
}
