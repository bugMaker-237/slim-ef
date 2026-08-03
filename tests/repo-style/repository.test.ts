import { Person } from '../entities/person';
import { PersonRepository } from './repos';
import { UOW } from '../unit-of-work';

describe('Repository pattern (GenericRepository)', () => {
  afterEach(async () => {
    await UOW.dispose();
  });

  it('Should query through a repository', async () => {
    // Arrange
    const repo = new PersonRepository();

    // Act
    const persons = await repo.where(p => p.IDNumber > 500000).toList();

    // Assert
    expect(persons.length).toBeGreaterThanOrEqual(61);
  });

  it('Should add and find through a repository', async () => {
    // Arrange
    const repo = new PersonRepository();
    const person = new Person();
    person.firstname = 'Repo';
    person.lastname = 'Test';
    person.IDNumber = 900;
    person.phone = '+237999';
    repo.add(person);

    // Act
    await UOW.saveChanges();
    const found = await repo.find(person.id);

    // Assert
    expect(found).toBeDefined();
    expect(found!.id).toBe(person.id);
  });

  it('Should remove through a repository', async () => {
    // Arrange
    const repo = new PersonRepository();
    const person = new Person();
    person.firstname = 'Repo';
    person.lastname = 'Remove';
    person.IDNumber = 901;
    person.phone = '+237999';
    repo.add(person);
    await UOW.saveChanges();

    // Act
    repo.remove(person);
    await UOW.saveChanges();
    const found = await repo.find(person.id);

    // Assert
    expect(found).toBeFalsy();
  });
});