import { FakeDBContext } from '../db-context';

describe('Logical LINQ', () => {
  it('Should have correct firstname and lastname', async () => {
    // Arrange
    const context = new FakeDBContext();

    // Act
    const person = await context.persons.first(
      p => p.firstname === 'Buggy' && p.lastname === 'Maker'
    );

    context.dispose();

    // Assert
    expect(person.firstname).toBe('Buggy');
    expect(person.lastname).toBe('Maker');
  });

  it('Should have 32 trips in date interval', async () => {
    // Arrange
    const context = new FakeDBContext();
    const data: { departureDate: Date; estimatedArrivalDate: Date } = {
      departureDate: new Date(2000, 1, 1),
      estimatedArrivalDate: new Date(2016, 1, 1)
    };
    // Act
    const trips = await context.trips
      .where(
        (t, $) =>
          t.departureDate > $.departureDate &&
          t.estimatedArrivalDate < $.estimatedArrivalDate,
        data
      )
      .toList();

    context.dispose();

    // Assert
    expect(trips.length).toEqual(32);
    expect(trips.some(t => t.departureDate < data.departureDate)).toBeFalsy();
    expect(
      trips.some(t => t.estimatedArrivalDate > data.estimatedArrivalDate)
    ).toBeFalsy();
  });

  it('Should have email starting with um and name including um', async () => {
    // Arrange
    const context = new FakeDBContext();
    const $ = {
      name: 'um'
    };
    // Act
    const agencies = await context.agencies
      .where(
        (a, _) =>
          a.email.endsWith(_.name) || (a.name.includes(_.name) && a.id > 45),
        $
      )
      .toList();

    context.dispose();

    // Assert
    expect(agencies.length).toEqual(8);
    expect(
      agencies.some(t => !t.email.endsWith($.name) && !t.name.includes($.name))
    ).toBeFalsy();
  });

  it('Should have 35 trips with departureDate and arrivalDate as specified', async () => {
    // init
    const context = new FakeDBContext();
    const data: {
      departureDate: Date;
      estimatedArrivalDate: Date;
    } = {
      departureDate: new Date(2000, 1, 1),
      estimatedArrivalDate: new Date(2016, 1, 1)
    };
    // getting the data
    const trips = await context.trips
      .include(t => t.passengers)
      .where(
        (t, $) =>
          t.departureDate > $.departureDate &&
          (t.estimatedArrivalDate < $.estimatedArrivalDate ||
            t.passengers.some(p => p.willTravel === true)),
        data
      )
      .toList();

    context.dispose();

    // Assert
    expect(trips.length).toEqual(35);
  });
});
