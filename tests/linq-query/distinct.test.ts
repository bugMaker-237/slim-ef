import { FakeDBContext } from '../db-context';
import { Agency } from '../entities/agency';

describe('Select test', () => {
  it('Should select 1 agencyId', async () => {
    const context = new FakeDBContext();

    const agency = new Agency();
    agency.name = 'Super agency';
    agency.email = 'Xtremtest@email.com';
    agency.phone = '+333333333';
    agency.isDistinct = true;
    context.agencies.add(agency);

    await context.saveChanges();

    console.log('Agency added:', agency.id);

    context.trips.add(
      ...[
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
      ]
    );
    await context.saveChanges();

    const ids = await context.trips
      .include(p => p.agency)
      .where((p, $) => p.agency.isDistinct === true && p.agencyId === $.id, {
        id: agency.id
      })
      .select(p => ({
        aId: p.agencyId
      }))
      .distinct()
      .toList();

    console.log('Distinct agencyIds:', ids);

    const tripCount = await context.trips.count((t, $) => t.agencyId === $.id, {
      id: ids[0].aId
    });

    expect(ids).toBeDefined();
    expect(ids.length).toBe(1);
    expect(tripCount).toBe(2);
  });
});
