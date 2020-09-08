import { patch } from '../../src';
import { FakeDBContext } from '../db-context';
import { Person } from '../entities/person';

describe('Add person', () => {
  it('Should update person :: style 1', async () => {
    // Arrange
    const context = new FakeDBContext();
    const person = new Person();
    person.id = '0488dc56-ea71-4773-818c-c2069ae3108d';
    person.firstname = 'Bug';
    person.lastname = 'Master';
    person.tripId = '02c07681-6faf-49f6-b5fc-7757ca5dd85e';

    // Act
    context.persons.add(person);
    await context.saveChanges();
    context.dispose();

    // Assert
    expect(person.id).toBe('0488dc56-ea71-4773-818c-c2069ae3108d');
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
