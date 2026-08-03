import { FakeDBContext } from '../db-context';

describe('Paging LINQ (take/skip)', () => {
  it('Should take a specified number of elements', async () => {
    // Arrange
    const context = new FakeDBContext();

    // Act
    const persons = await context.persons
      .orderBy(p => p.IDNumber)
      .take(10)
      .toList();

    context.dispose();

    // Assert
    expect(persons.length).toBe(10);
  });

  it('Should skip a specified number of elements', async () => {
    // Arrange
    const context = new FakeDBContext();

    // Act
    const all = await context.persons.orderBy(p => p.IDNumber).toList();
    const skipped = await context.persons
      .orderBy(p => p.IDNumber)
      .skip(10)
      .toList();

    context.dispose();

    // Assert
    expect(skipped.length).toBe(all.length - 10);
    expect(skipped[0].IDNumber).toBe(all[10].IDNumber);
  });

  it('Should combine skip and take', async () => {
    // Arrange
    const context = new FakeDBContext();

    // Act
    const persons = await context.persons
      .orderBy(p => p.IDNumber)
      .skip(5)
      .take(5)
      .toList();

    context.dispose();

    // Assert
    expect(persons.length).toBe(5);
  });
});
