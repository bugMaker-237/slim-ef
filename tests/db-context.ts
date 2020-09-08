import { Connection } from 'typeorm';
import { DbContext, DbSet, DbSetEntity, IDbSet } from '../src/index';
import { ModelBuilder } from '../src/uow/model-builder';
import { Agency } from './entities/agency';
import { Person } from './entities/person';
import { Trip } from './entities/trip';

export class FakeDBContext extends DbContext {
  constructor() {
    super(
      new Connection({
        type: 'mysql',
        host: 'localhost',
        port: 3306,
        username: 'admin',
        password: 'admin0000',
        database: 'slim_ef_test',
        entities: [Person, Agency, Trip],
        synchronize: true
      })
    );
  }

  protected onModelCreation<BaseType extends object = any>(
    builder: ModelBuilder<BaseType>
  ): void {
    builder.entity(Person).hasQueryFilter(q => q.IDNumber > 50);
  }
  @DbSetEntity(Person)
  public readonly persons: IDbSet<Person>;

  @DbSetEntity(Agency)
  public readonly agencies: IDbSet<Agency>;

  @DbSetEntity(Trip)
  public readonly trips: IDbSet<Trip>;
}
