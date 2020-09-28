import { With } from '../../src';
import { FakeDBContext } from '../db-context';
import { Person } from '../entities/person';

describe('Add person', () => {
  it('Should update person :: style 1', async () => {
    // Arrange
    const context = new FakeDBContext();
    let dbPerson = await context.persons.first();
    const person = {
      ...dbPerson,
      firstname: 'Bug',
      lastname: 'Master',
      tripId: '0e0079ce-48c2-3d6c-9cea-27b7b998a2f6',
      phone: '+8975211213',
      IDNumber: 7985631
    };
    // Act
    context.persons.attach(person);
    await context.saveChanges();
    dbPerson = await context.persons.first((p, $) => p.id === $.id, { id: dbPerson.id });
    context.dispose();

    // Assert
    expect(person.id).toBe(dbPerson.id);
    expect(person.firstname).toBe(dbPerson.firstname);
    expect(person.lastname).toBe(dbPerson.lastname);
  });

  it('Should add person :: style 2', async () => {
    // Arrange
    const context = new FakeDBContext();
    // Act
    context.persons.add({
      firstname: 'Another Buggy',
      lastname: 'Maker 2',
      IDNumber: 987654321,
      phone: '+237677788852'
    });
    const { added } = await context.saveChanges();
    context.dispose();

    // Assert
    expect(added[0].id).toBeDefined();
    expect(added[0].firstname).toBe('Another Buggy');
  });
});
