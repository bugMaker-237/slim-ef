import { EntitySchema } from 'typeorm';
import { Trip } from './trip';

export class Agency {
  id!: number;
  name!: string;
  phone!: string;
  email?: string;
  isDistinct!: boolean;
  trips?: Trip[];
}

export const AgencySchema = new EntitySchema<Agency>({
  name: 'Agency',
  target: Agency,
  columns: {
    id: {
      type: Number,
      primary: true,
      generated: true
    },
    name: {
      type: String
    },
    phone: {
      type: String
    },
    email: {
      type: String,
      nullable: true
    },
    isDistinct: {
      type: Boolean,
      default: false
    }
  },
  relations: {
    trips: {
      type: 'one-to-many',
      target: 'Trip',
      inverseSide: 'agency'
    }
  }
});
