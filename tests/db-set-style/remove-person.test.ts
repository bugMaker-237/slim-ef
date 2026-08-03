import { FakeDBContext } from '../db-context';
import { Person } from '../entities/person';

describe('Remove person', () => {
  it('Should remove person', async () => {
    // Arrange
    const context = new FakeDBContext();
    const newPerson = new Person();
    newPerson.firstname = 'Buggy';
    newPerson.lastname = 'Maker';
    newPerson.IDNumber = 800;
    newPerson.phone = '+237699977788';

    // Act
    context.persons.add(newPerson);
    await context.saveChanges();

    // Act
    const personId = newPerson.id;

    const person = await context.persons.find(personId);
    context.remove(person);
    await context.saveChanges();

    const personIsThere = await context.persons.find(personId);
    context.dispose();

    // Assert
    expect(personIsThere).toBeNull();
  });
});
