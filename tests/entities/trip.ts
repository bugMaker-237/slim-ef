import { EntitySchema } from 'typeorm';
import { Agency } from './agency';
import { Person } from './person';

export class Trip {
  id!: string;
  agency!: Agency;
  agencyId!: number;
  departureDate!: Date;
  estimatedArrivalDate?: Date;
  passengers!: Person[];
}

export const TripSchema = new EntitySchema<Trip>({
  name: 'Trip',
  target: Trip,
  columns: {
    id: {
      type: String,
      primary: true,
      generated: 'uuid'
    },
    agencyId: {
      type: Number
    },
    departureDate: {
      type: Date
    },
    estimatedArrivalDate: {
      type: Date,
      nullable: true
    }
  },
  relations: {
    agency: {
      type: 'many-to-one',
      target: 'Agency',
      inverseSide: 'trips'
    },
    passengers: {
      type: 'one-to-many',
      target: 'Person',
      inverseSide: 'trip'
    }
  }
});
