import { FakeDBContext } from '../db-context';
import { Person } from '../entities/person';

describe('DbContext features', () => {
  it('Should find an existing entity by id', async () => {
    // Arrange
    const context = new FakeDBContext();
    const p = await context.persons.first();

    // Act
    const found = await context.persons.find(p.id);

    context.dispose();

    // Assert
    expect(found).toBeDefined();
    expect(found!.id).toBe(p.id);
  });

  it('Should return falsy when finding an unknown id', async () => {
    // Arrange
    const context = new FakeDBContext();

    // Act
    const found = await context.persons.find('does-not-exist');

    context.dispose();

    // Assert
    expect(found).toBeFalsy();
  });

  it('Should expose exists()', async () => {
    // Arrange
    const context = new FakeDBContext();
    const p = await context.persons.first();

    // Act
    const exists = await context.persons.exists(p.id);
    const notExists = await context.persons.exists('does-not-exist');

    context.dispose();

    // Assert
    expect(exists).toBe(true);
    expect(notExists).toBe(false);
  });

  it('Should return undefined from firstOrDefault when no match', async () => {
    // Arrange
    const context = new FakeDBContext();

    // Act
    const res = await context.persons.firstOrDefault(
      p => p.id === 'does-not-exist'
    );

    context.dispose();

    // Assert
    expect(res).toBeFalsy();
  });

  it('Should throw from first when no element exists', async () => {
    // Arrange
    const context = new FakeDBContext();

    // Act & Assert
    await expect(
      context.persons.where(p => p.id === 'does-not-exist').first()
    ).rejects.toThrow();
    context.dispose();
  });

  it('Should create an ad-hoc DbSet via set()', async () => {
    // Arrange
    const context = new FakeDBContext();

    // Act
    const dbSet = context.set(Person);
    const persons = await dbSet.take(5).toList();

    context.dispose();

    // Assert
    expect(persons.length).toBe(5);
  });

  it('Should run a raw SQL query', async () => {
    // Arrange
    const context = new FakeDBContext();

    // Act
    const res = await context.query('SELECT COUNT(*) AS cnt FROM person', []);

    context.dispose();

    // Assert
    expect(Number(res[0].cnt)).toBeGreaterThanOrEqual(100);
  });

  it('Should not persist an entity after rollback of its type', async () => {
    // Arrange
    const context = new FakeDBContext();
    const countBefore = await context.persons.count();

    // Act
    context.persons.add({
      firstname: 'Rollback',
      lastname: 'Me',
      IDNumber: 70,
      phone: '+1'
    });
    context.rollback(Person);
    await context.saveChanges();
    const countAfter = await context.persons.count();

    context.dispose();

    // Assert
    expect(countAfter).toBe(countBefore);
  });

  it('Should not persist an entity that was untracked', async () => {
    // Arrange
    const context = new FakeDBContext();

    // Act
    const person = new Person();
    person.firstname = 'UnTrack';
    person.lastname = 'Me';
    person.IDNumber = 70;
    person.phone = '+1';
    context.persons.add(person);
    context.persons.unTrack(person);
    await context.saveChanges();

    const res = await context.persons
      .where(p => p.firstname === 'UnTrack')
      .firstOrDefault();
    context.dispose();

    // Assert
    expect(res).toBeFalsy();
  });

  it('Should load related data of an entity', async () => {
    // Arrange
    const context = new FakeDBContext();
    const p = await context.persons.first();

    // Act
    const loaded = await context.persons.loadRelatedData(p);

    context.dispose();

    // Assert
    expect(loaded).toBeDefined();
    expect((loaded as any).id).toBe(p.id);
  });
});