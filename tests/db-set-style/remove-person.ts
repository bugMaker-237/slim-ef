import { With } from '../../src';
import { FakeDBContext } from '../db-context';
import { Person } from '../entities/person';

describe('Remove person', () => {
  it('Should remove person', async () => {
    // Arrange
    const context = new FakeDBContext();
    const personId = '015c5549-3bbb-31ef-b2d5-402c6a9f746e';

    // Act
    const person = await context.persons.find(personId);
    context.remove(person);
    await context.saveChanges();

    const personIsThere = await context.persons.find(personId);
    context.dispose();

    // Assert
    expect(personIsThere).toBeUndefined();
  });
});
