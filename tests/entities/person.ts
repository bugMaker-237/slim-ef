import { EntitySchema } from 'typeorm';
import { Trip } from './trip';

export class Person {
  id!: string;
  trip!: Trip;
  tripId?: string;
  firstname!: string;
  lastname!: string;
  phone!: string;
  IDNumber!: number;
  email?: string;
  willTravel!: boolean;
}

export const PersonSchema = new EntitySchema<Person>({
  name: 'Person',
  target: Person,
  columns: {
    id: {
      type: String,
      primary: true,
      generated: 'uuid'
    },
    tripId: {
      type: String,
      nullable: true
    },
    firstname: {
      type: String
    },
    lastname: {
      type: String
    },
    phone: {
      type: String
    },
    IDNumber: {
      type: Number
    },
    email: {
      type: String,
      nullable: true
    },
    willTravel: {
      type: Boolean,
      default: false
    }
  },
  relations: {
    trip: {
      type: 'many-to-one',
      target: 'Trip',
      inverseSide: 'passengers'
    }
  }
});
