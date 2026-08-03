import {
  DbContextModelBuilder,
  IDbContextOptionsBuilder,
  UnitOfWork
} from '@slim-ef/core';
import {
  SQLQuerySpecificationEvaluator,
  TypeOrmConnectionAdapter
} from '@slim-ef/typeorm';
import { resolve } from 'path';
import { AgencySchema } from './entities/agency';
import { Person, PersonSchema } from './entities/person';
import { TripSchema } from './entities/trip';

export class FakeUnitOfWork extends UnitOfWork {
  constructor() {
    /**
     * SQLite connection
     */
    super(
      new TypeOrmConnectionAdapter({
        type: 'better-sqlite3',
        database: resolve(__dirname, 'seeder', 'slim_ef_test.db'),
        entities: [PersonSchema, AgencySchema, TripSchema],
        synchronize: false
      }),
      SQLQuerySpecificationEvaluator
    );
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
