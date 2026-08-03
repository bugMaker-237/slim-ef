import { FakeDBContext } from '../db-context';

describe('Grouping LINQ (groupBy)', () => {
  it('Should group elements by a key', async () => {
    // Arrange
    const context = new FakeDBContext();

    // Act
    const groups = await context.persons
      .groupBy(p => p.willTravel)
      .toList();

    context.dispose();

    // Assert
    expect(groups.length).toBeGreaterThanOrEqual(1);
    const keys = groups.map(g => g.willTravel);
    expect(new Set(keys).size).toBe(groups.length);
  });

  it('Should chain a second grouping with thenGroupBy', async () => {
    // Arrange
    const context = new FakeDBContext();

    // Act
    const groups = await context.persons
      .groupBy(p => p.willTravel)
      .thenGroupBy(p => p.IDNumber)
      .toList();

    context.dispose();

    // Assert
    expect(groups.length).toBeGreaterThanOrEqual(1);
  });
});
