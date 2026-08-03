import { FakeDBContext } from '../db-context';
import { Person } from '../entities/person';

describe('Global query filters', () => {
  it('Should apply the model level query filter by default', async () => {
    // Arrange
    const context = new FakeDBContext();
    const person = new Person();
    person.firstname = 'Filtered';
    person.lastname = 'Out';
    person.IDNumber = 5; // below the DbContext filter threshold (IDNumber > 50)
    person.phone = '+000';
    context.persons.add(person);
    await context.saveChanges();

    // Act
    const foundDefault = await context.persons
      .where((p, $) => p.id === $.id, { id: person.id })
      .firstOrDefault();
    const foundIgnored = await context.persons
      .ignoreQueryFilters()
      .where((p, $) => p.id === $.id, { id: person.id })
      .firstOrDefault();

    context.dispose();

    // Assert
    expect(foundDefault).toBeFalsy();
    expect(foundIgnored).toBeDefined();
    expect(foundIgnored!.id).toBe(person.id);
  });
});