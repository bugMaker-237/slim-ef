import { patch } from '../../src';
import { FakeDBContext } from '../db-context';
import { Person } from '../entities/person';

describe('Add person', () => {
  it('Should add person :: style 1', async () => {
    // Arrange
    const context = new FakeDBContext();
    const person = new Person();
    person.firstname = 'Buggy';
    person.lastname = 'Maker';
    person.IDNumber = 800;
    person.phone = '+237699977788';

    // Act
    context.persons.add(person);
    await context.saveChanges();
    context.dispose();

    // Assert
    expect(person.id).toBeDefined();
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
