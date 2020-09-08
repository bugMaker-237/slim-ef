import {
  Column,
  Entity,
  ManyToOne,
  PrimaryColumn,
  PrimaryGeneratedColumn
} from 'typeorm';
import { Trip } from './trip';

@Entity()
export class Person {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Trip, c => c.passengers)
  trip?: Trip;

  @Column({
    nullable: true
  })
  tripId?: string;

  @Column()
  firstname: string;

  @Column()
  lastname: string;

  @Column()
  phone: string;

  @Column()
  IDNumber: number;

  @Column({
    nullable: true
  })
  email: string;

  @Column({
    default: false
  })
  willTravel: boolean;
}
