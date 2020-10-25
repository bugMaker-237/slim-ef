import { FakeDBContext } from '../db-context';

describe('Iniitialization', () => {
  it('Should register dbset', () => {
    // Arrange
    const context = new DeltaTravelContext();

    // Assert
    expect(context.persons).toBeDefined();
    expect(context.agencies).toBeDefined();
    expect(context.trips).toBeDefined();
  });
});
