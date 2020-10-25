import { EntityRepository, GenericRepository } from '../../src/repository';
import { Agency } from '../entities/agency';
import { Person } from '../entities/person';
import { Trip } from '../entities/trip';
import { UOW } from '../unit-of-work';

@EntityRepository(Agency)
export class AgencyRepository extends GenericRepository<Agency> {
  constructor() {
    super(UOW);
  }
}

// tslint:disable-next-line: max-classes-per-file
@EntityRepository(Person)
export class PersonRepository extends GenericRepository<Person> {
  constructor() {
    super(UOW);
  }
}

// tslint:disable-next-line: max-classes-per-file
@EntityRepository(Trip)
export class TripRepository extends GenericRepository<Trip> {
  constructor() {
    super(UOW);
  }
}
