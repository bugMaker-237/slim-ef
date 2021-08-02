import { FakeDBContext } from '../db-context';
import { Person } from '../entities/person';

describe('Transactions test', () => {
  it('Should open transaction', async () => {
    // Arrange
    const context = new FakeDBContext();

    // Act
    await context.openTransaction();
    const isOpened = context.transactionIsOpen();
    await context.rollbackTransaction();

    // Assert
    expect(isOpened).toBe(true);
  });

  it('Should open transaction then rollback', async () => {
    // Arrange
    const context = new FakeDBContext();

    // Act
    await context.openTransaction();
    const isOpened = context.transactionIsOpen();
    await context.rollbackTransaction();
    const isStillOpened = context.transactionIsOpen();

    // Assert
    expect(isOpened).toBeTruthy();
    expect(isStillOpened).toBeFalsy();
  });
  it('Should add person then rollback', async () => {
    // Arrange
    const context = new FakeDBContext();

    // Act
    await context.openTransaction();
    context.persons.add({
      firstname: 'Another Buggy',
      lastname: 'Maker 2',
      IDNumber: 987654321,
      phone: '+237677788852'
    });
    const { added } = await context.saveChanges();
    const newPerson: Person = added[0];

    await context.rollbackTransaction();
    const exists = await context.persons.exists(newPerson.id);

    // Assert
    expect(newPerson.id).toBeDefined();
    expect(exists).toBeFalsy();
  });
  it('Should add person then commit', async () => {
    // Arrange
    const context = new FakeDBContext();

    // Act
    await context.openTransaction();
    context.persons.add({
      firstname: 'Another Buggy',
      lastname: 'Maker 2',
      IDNumber: 987654321,
      phone: '+237677788852'
    });
    const { added } = await context.saveChanges();
    const newPerson: Person = added[0];

    await context.commitTransaction();

    const existsNow = await context.persons.exists(newPerson.id);

    // Assert
    expect(newPerson.id).toBeDefined();
    expect(existsNow).toBeTruthy();
  });
});
