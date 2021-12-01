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
    expect([...new Set(ids.map(id => id.aId))].length).toBe(116);
  });
});
