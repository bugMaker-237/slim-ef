import {
  DbContext,
  DbContextModelBuilder,
  DbSetEntity,
  IDbContextOptionsBuilder,
  IDbSet
} from '@slim-ef/core';
import {
  SQLQuerySpecificationEvaluator,
  TypeOrmConnectionAdapter
} from '@slim-ef/typeorm';
import { resolve } from 'path';
import { Agency, AgencySchema } from './entities/agency';
import { Person, PersonSchema } from './entities/person';
import { Trip, TripSchema } from './entities/trip';

export class FakeDBContext extends DbContext {
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

  @DbSetEntity(Person)
  public readonly persons!: IDbSet<Person, Person>;

  @DbSetEntity(Agency)
  public readonly agencies!: IDbSet<Agency, Agency>;

  @DbSetEntity(Trip)
  public readonly trips!: IDbSet<Trip, Trip>;
}
