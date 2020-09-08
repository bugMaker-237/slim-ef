import {
  Column,
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryColumn,
  PrimaryGeneratedColumn
} from 'typeorm';
import { Agency } from './agency';
import { Person } from './person';

@Entity()
export class Trip {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Agency, (c) => c.trips)
  agency: Agency;

  @Column()
  agencyId: number;

  @Column()
  departureDate: Date;

  @Column({ nullable: true })
  estimatedArrivalDate: Date;

  @OneToMany(() => Person, (p) => p.trip)
  passengers: Person[];
}
