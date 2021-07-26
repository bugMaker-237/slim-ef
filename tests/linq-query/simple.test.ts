import { patch } from '../../src';
import { FakeDBContext } from '../db-context';
import { Person } from '../entities/person';

describe('Simple LINQ', () => {
  it('Should have at least 100 persons', async () => {
    // Arrange
    const context = new FakeDBContext();

    // Act
    const persons = await context.persons.toList();

    context.dispose();

    // Assert
    expect(persons.length).toBeGreaterThanOrEqual(100);
  });

  it('Should have correct firstname', async () => {
    // Arrange
    const context = new FakeDBContext();

    // Act
    const person = await context.persons.first(p => p.firstname === 'Buggy');

    context.dispose();

    // Assert
    expect(person.firstname).toBe('Buggy');
    expect(person.lastname).toBe('Maker');
  });

  it('Firstname Should start with bug', async () => {
    // Arrange
    const context = new FakeDBContext();

    // Act
    const persons = await context.persons
      .where(p => p.firstname.startsWith('Bugg'))
      .toList();

    context.dispose();

    // Assert
    expect(persons.length).toBeGreaterThanOrEqual(1);
    expect(persons[0].firstname).toContain('Bugg');
  });

  it('Firstname Should end with gy', async () => {
    // Arrange
    const context = new FakeDBContext();

    // Act
    const persons = await context.persons
      .where(p => p.firstname.endsWith('uggy'))
      .toList();

    context.dispose();

    // Assert
    expect(persons.length).toBeGreaterThanOrEqual(1);
    expect(persons[0].firstname).toContain('uggy');
  });

  it('Should have 41 persons traveling', async () => {
    // Arrange
    const context = new FakeDBContext();

    // Act
    const persons = await context.persons
      .where(p => p.willTravel === true)
      .toList();

    context.dispose();

    // Assert
    expect(persons.length).toBeGreaterThanOrEqual(41);
  });

  it('Should have 41 persons traveling (Double-Exclamation)', async () => {
    // Arrange
    const context = new FakeDBContext();

    // Act
    const persons = await context.persons.where(p => !!p.willTravel).toList();

    context.dispose();

    // Assert
    expect(persons.length).toBeGreaterThanOrEqual(41);
  });

  it('Should have 61 persons not traveling (Exclamation)', async () => {
    // Arrange
    const context = new FakeDBContext();

    // Act
    const persons = await context.persons.where(p => !p.willTravel).toList();

    context.dispose();

    // Assert
    expect(persons.length).toBeGreaterThanOrEqual(61);
  });

  it('Should have 61 persons not traveling', async () => {
    // Arrange
    const context = new FakeDBContext();

    // Act
    const persons = await context.persons
      .where(p => p.willTravel === false)
      .toList();

    context.dispose();

    // Assert
    expect(persons.length).toBeGreaterThanOrEqual(61);
  });
});
