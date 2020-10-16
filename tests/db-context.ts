import { Connection } from 'typeorm';
import { SqliteConnectionOptions } from 'typeorm/driver/sqlite/SqliteConnectionOptions';
import {
  DbContext,
  DbSet,
  DbSetEntity,
  IDbSet,
  SQLQuerySpecificationEvaluator
} from '../src/index';
import { IDbContextOptionsBuilder } from '../src/uow/interfaces';
import { DbContextModelBuilder } from '../src/uow/model-builder';
import { Agency } from './entities/agency';
import { Person } from './entities/person';
import { Trip } from './entities/trip';

export class FakeDBContext extends DbContext {
  constructor() {
    super(
      new Connection({
        type: 'sqlite',
        database: ':memory:',
        entities: [Person, Agency, Trip],
        synchronize: true
      } as SqliteConnectionOptions),
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
  public readonly persons: IDbSet<Person>;

  @DbSetEntity(Agency)
  public readonly agencies: IDbSet<Agency>;

  @DbSetEntity(Trip)
  public readonly trips: IDbSet<Trip>;
}
