import { Column, Entity, OneToMany, PrimaryColumn, PrimaryGeneratedColumn } from 'typeorm';
import { Trip } from './trip';

@Entity()
export class Agency {
  @PrimaryGeneratedColumn()
  id: number;
  @Column()
  name: string;

  @Column()
  phone: string;

  @Column({
    nullable: true
  })
  email: string;

  @OneToMany(() => Trip, (p) => p.agency)
  trips?: Trip[];
}
