export class SelectStringProxy extends String {
  public $$propertyName: string;

  constructor(propName) {
    super();
    this.$$propertyName = propName;
  }
}

// tslint:disable-next-line: max-classes-per-file
export class SelectNumberProxy extends Number {
  public $$propertyName: string;

  constructor(propName) {
    super();
    this.$$propertyName = propName;
  }
}

// tslint:disable-next-line: max-classes-per-file
export class SelectBooleanProxy extends Boolean {
  public $$propertyName: string;

  constructor(propName) {
    super();
    this.$$propertyName = propName;
  }
}

// tslint:disable-next-line: max-classes-per-file
export class SelectArrayProxy extends Array {
  public $$propertyName: string;

  constructor(propName) {
    super();
    this.$$propertyName = propName;
  }
}
