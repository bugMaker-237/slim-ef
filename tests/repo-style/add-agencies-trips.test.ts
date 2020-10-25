import { patch } from '../../src';
import { FakeDBContext } from '../db-context';
import { Agency } from '../entities/agency';
import { Person } from '../entities/person';
import { Trip } from '../entities/trip';
import { AgencyRepository, TripRepository } from './repos';
import { UOW } from '../unit-of-work';
describe('Add agencies and trips', () => {
  it('Should add agency :: style 1', async () => {
    // Arrange
    const agRepo = new AgencyRepository();
    const tripRepo = new TripRepository();
    const agency = new Agency();
    agency.name = 'Hello mundo';
    agency.email = 'mundo@agency.super';
    agency.phone = '+996985321';

    const t1 = new Trip();
    t1.departureDate = new Date();
    t1.estimatedArrivalDate = new Date('09/10/2030');
    t1.agency = agency;

    const t2 = new Trip();
    t2.departureDate = new Date();
    t2.estimatedArrivalDate = new Date('09/11/2030');
    t2.agency = agency;

    // Act
    agRepo.add(agency);
    await UOW.execute;

    t1.agencyId = agency.id;
    t2.agencyId = agency.id;
    tripRepo.add(t1, t2);
    await context.saveChanges();

    const dbAgency = await context.agencies.first((a, $) => a.id === $.id, {
      id: agency.id
    });

    context.dispose();

    // Assert
    expect(agency.id).toBeDefined();
    expect(agency.id).toEqual(dbAgency.id);
    expect(agency.name).toEqual(dbAgency.name);
    expect(t1.id).toBeDefined();
    expect(t2.id).toBeDefined();
  });

  it('Should add agency :: style 2', async () => {
    // Arrange
    const context = new FakeDBContext();

    // Act
    context.agencies.add({
      name: 'Hello secundo',
      email: 'secundo@agency.super',
      phone: '+996985321'
    });
    let saved = await context.saveChanges();
    const agency = saved.added[0];

    context.trips.add(
      {
        departureDate: new Date(),
        estimatedArrivalDate: new Date('09/10/2030'),
        agencyId: agency.id
      },
      {
        departureDate: new Date(),
        estimatedArrivalDate: new Date('09/11/2030'),
        agencyId: agency.id
      }
    );

    saved = await context.saveChanges();
    const [t1, t2] = saved.added;

    context.dispose();

    // Assert
    expect(agency.id).toBeDefined();
    expect(t1.id).toBeDefined();
    expect(t2.id).toBeDefined();
  });
});
