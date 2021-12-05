import { FakeDBContext } from '../db-context';
import { Agency } from '../entities/agency';

describe('Select test', () => {
  it('Should select 116 agencyIds', async () => {
    const context = new FakeDBContext();

    const ids = await context.trips
      .include(p => p.agency)
      .groupBy(p => p.agencyId)
      .select(p => ({
        aId: p.agencyId
      }))
      .distinct()
      .toList();

    expect(ids).toBeDefined();
    // these 2 use cases is to handle the fact that when running all the tests
    // 2 trips are being added to the db
    expect([...new Set(ids.map(id => id.aId))].length).toBeGreaterThanOrEqual(
      116
    );
    expect([...new Set(ids.map(id => id.aId))].length).toBeLessThanOrEqual(118);
  });
});
