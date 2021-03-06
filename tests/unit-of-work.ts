import { resolve } from 'path';
import { Connection } from 'typeorm';
import { MysqlConnectionOptions } from 'typeorm/driver/mysql/MysqlConnectionOptions';
import { SqliteConnectionOptions } from 'typeorm/driver/sqlite/SqliteConnectionOptions';
import { SQLQuerySpecificationEvaluator } from '../src';
import { UnitOfWork } from '../src/uow';
import { IDbContextOptionsBuilder } from '../src/uow/interfaces';
import { DbContextModelBuilder } from '../src/uow/model-builder';
import { Agency } from './entities/agency';
import { Person } from './entities/person';
import { Trip } from './entities/trip';

class FakeUnitOfWork extends UnitOfWork {
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
}

/**
 * In this programming pattern, since the unit of work is injected in
 * every repository, we are not going to create multiple connection instances
 * so a singleton pattern has to be applied here
 */
export const UOW = new FakeUnitOfWork();
