import { FakeDBContext } from '../db-context';

function isSortedAsc(values: number[]): boolean {
  return values.every((v, i) => i === 0 || values[i - 1] <= v);
}

describe('Ordering LINQ (orderBy)', () => {
  it('Should order elements in ascending order', async () => {
    // Arrange
    const context = new FakeDBContext();

    // Act
    const persons = await context.persons
      .orderBy(p => p.IDNumber)
      .take(30)
      .toList();

    context.dispose();

    // Assert
    expect(persons.length).toBe(30);
    expect(isSortedAsc(persons.map(p => p.IDNumber))).toBe(true);
  });

  it('Should order elements in descending order', async () => {
    // Arrange
    const context = new FakeDBContext();

    // Act
    const persons = await context.persons
      .orderByDescending(p => p.IDNumber)
      .take(30)
      .toList();

    context.dispose();

    // Assert
    expect(persons.length).toBe(30);
    expect(isSortedAsc(persons.map(p => p.IDNumber).reverse())).toBe(true);
  });

  it('Should perform subsequent ordering with thenOrderBy', async () => {
    // Arrange
    const context = new FakeDBContext();

    // Act
    const persons = await context.persons
      .orderBy(p => p.willTravel)
      .thenOrderBy(p => p.firstname)
      .take(40)
      .toList();

    context.dispose();

    // Assert: primary key sorted, secondary key sorted within equal primary values
    expect(persons.length).toBe(40);
    for (let i = 1; i < persons.length; i++) {
      const prev = persons[i - 1];
      const cur = persons[i];
      if (prev.willTravel === cur.willTravel) {
        expect(prev.firstname <= cur.firstname).toBe(true);
      } else {
        expect(prev.willTravel < cur.willTravel).toBe(true);
      }
    }
  });
});
