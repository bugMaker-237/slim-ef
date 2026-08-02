import { FakeDBContext } from '../db-context';

describe('Select test', () => {
  it('Should select 1 agencyId', async () => {
    const context = new FakeDBContext();

    const agency = {
      name: 'Super agency',
      email: 'Xtremtest@email.com',
      phone: '+333333333',
      isDistinct: true,
      trips: [
        {
          departureDate: new Date(),
          estimatedArrivalDate: new Date('09/10/2030')
        },
        {
          departureDate: new Date(),
          estimatedArrivalDate: new Date('09/11/2030')
        }
      ]
    };
    context.agencies.add(agency);

    await context.saveChanges();

    const ids = await context.trips
      .include(p => p.agency)
      .where(p => p.agency.isDistinct === true)
      .select(p => ({
        aId: p.agencyId
      }))
      .distinct()
      .toList();

    const tripCount = await context.trips.count((t, $) => t.agencyId === $.id, {
      id: ids[0].aId
    });

    expect(ids).toBeDefined();
    expect(ids.length).toBe(1);
    expect(tripCount).toBe(2);
  });
});
