import { FakeDBContext } from './db-context';
import { Person } from './entities/person';

async function getPersons(): Promise<Person[]> {
  const context = new FakeDBContext();

  const persons = await context.persons.wh.toList();

  context.dispose();

  return persons;
}
