import { FakeDBContext } from '../db-context';

/**
 * Make sure to run this tests before deleting any entity or running delete tests in the db
 * Because the computed values field values may not be identical again
 */
describe('SQL Functions call - LINQ', () => {
  it('Should have average greater than or equal to 500000', async () => {
    // Arrange
    const context = new FakeDBContext();

    // Act
    const avg = await context.persons.average(
      p => p.IDNumber
    );

    context.dispose();

    // Assert
    expect(avg).toBeGreaterThanOrEqual(500000);
  });

  it('Should have sum greater than or equal to 57512589', async () => {
    // Arrange
    const context = new FakeDBContext();

    // Act
    const sum = await context.persons.sum(
      p => p.IDNumber
    );

    context.dispose();

    // Assert
    expect(sum).toBeGreaterThanOrEqual(57512589);
  });

  it('Should have count greater than or equal to 100', async () => {
    // Arrange
    const context = new FakeDBContext();

    // Act
    const count = await context.persons.count();

    context.dispose();

    // Assert
    expect(count).toBeGreaterThanOrEqual(100);
  });

  it('Should have count greater than or equal to 61', async () => {
    // Arrange
    const context = new FakeDBContext();

    // Act
    const count = await context.persons.count(p => p.IDNumber > 500000);

    context.dispose();

    // Assert
    expect(count).toBeGreaterThanOrEqual(61);
  });

  it('Should have MIN firstname equal to Abbey', async () => {
    // Arrange
    const context = new FakeDBContext();

    // Act
    const min = await context.persons.min(
      p => p.firstname
    );

    context.dispose();

    // Assert
    expect(min).toBe('Abbey');
  });

  it('Should have max firstname equal to Zoey', async () => {
    // Arrange
    const context = new FakeDBContext();

    // Act
    const max = await context.persons.max(
      p => p.firstname
    );

    context.dispose();

    // Assert
    expect(max).toBe('Zoey');
  });

});
