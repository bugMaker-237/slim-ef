import { FakeDBContext } from '../db-context';

class TripResponse {
  constructor(
    public agencyName: string,
    public agencyEmail: string,
    public departureDate: Date,
    public passengers: { name: string; phone: string; ID: number }[]
  ) {}
}
describe('Select test', () => {
  it('Should create instance of an anonymous object with values', async () => {
    const context = new FakeDBContext();

    const person = await context.persons
      .include(p => p.trip)
      .thenInclude(t => t.agency)
      .select(p => ({
        att1: p.trip.departureDate,
        att2: p.trip.agency.name
      }))
      .firstOrDefault(p => p.id === 'd1fa69b0-2092-3b6f-90d5-870e902c8315');

    console.log({ person });
    expect(person).toBeDefined();
    expect(person.att1).toBeDefined(); // 1974-02-02 12:21:00
    expect(person.att2).toBeDefined(); // 'Recusandae aspernatur.'
  });
  it('Should create instance of response with values', async () => {
    const context = new FakeDBContext();

    const tripsQuery = context.trips
      .include(t => t.agency)
      .include(t => t.passengers)
      .select(
        t =>
          new TripResponse(
            t.agency.name,
            t.agency.email,
            t.departureDate,
            t.passengers.map(p => ({
              name: p.lastname,
              phone: p.phone,
              ID: p.IDNumber
            }))
          )
      );

    const res = await tripsQuery.toList();

    expect(res.length).toBeGreaterThanOrEqual(100);
    expect(res[0].passengers).toBeDefined();
  });

  it('Should filter and create instance of response with values', async () => {
    const context = new FakeDBContext();
    const ctx = {
      departureDate: new Date(2000, 1, 1),
      estimatedArrivalDate: new Date(2016, 1, 1)
    };

    const tripsQuery = context.trips
      .include(t => t.agency)
      .include(t => t.passengers)
      .where(
        (t, $) =>
          t.departureDate > $.departureDate &&
          (t.estimatedArrivalDate < $.estimatedArrivalDate ||
            t.passengers.some(p => p.willTravel === true)),
        ctx
      )
      .select(
        t =>
          new TripResponse(
            t.agency.name,
            t.agency.email,
            t.departureDate,
            t.passengers.map(p => ({
              name: p.lastname,
              phone: p.phone,
              ID: p.IDNumber
            }))
          )
      );

    const res = await tripsQuery.toList();

    expect(res.length).toEqual(35);
    expect(res[0].passengers).toBeDefined();
  });
});
