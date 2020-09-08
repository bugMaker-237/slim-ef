import { patch } from '../../src';
import { FakeDBContext } from '../db-context';
import { Person } from '../entities/person';

describe('Simple LINQ', () => {
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
    expect(persons.length).toEqual(1);
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
    expect(persons.length).toEqual(1);
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
    expect(persons.length).toEqual(41);
  });

  it('Should have 41 persons traveling (!!)', async () => {
    // Arrange
    const context = new FakeDBContext();

    // Act
    const persons = await context.persons.where(p => !!p.willTravel).toList();

    context.dispose();

    // Assert
    expect(persons.length).toEqual(41);
  });

  it('Should have 59 persons not traveling (Exclamation)', async () => {
    // Arrange
    const context = new FakeDBContext();

    // Act
    const persons = await context.persons.where(p => !p.willTravel).toList();

    context.dispose();

    // Assert
    expect(persons.length).toEqual(59);
  });

  it('Should have 59 persons not traveling', async () => {
    // Arrange
    const context = new FakeDBContext();

    // Act
    const persons = await context.persons
      .where(p => p.willTravel === false)
      .toList();

    context.dispose();

    // Assert
    expect(persons.length).toEqual(59);
  });
});
