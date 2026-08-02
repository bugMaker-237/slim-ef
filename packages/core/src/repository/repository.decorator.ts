import { DbContext } from '../uow';

const repositoryMetadataKey = Symbol('entityRepository:key');
const entityMetadataKey = Symbol('entity:key');
const propMetadataKey = Symbol('prop:key');
const propListPropertyName = 'prop:list';

interface ClassMetadata {
  values: Map<symbol, unknown>;
  properties: Map<string | symbol, Map<symbol, unknown>>;
}

const metadataStore = new WeakMap<Function, ClassMetadata>();

function getMetadata(target: Function): ClassMetadata {
  let metadata = metadataStore.get(target);

  if (!metadata) {
    metadata = {
      values: new Map(),
      properties: new Map()
    };

    metadataStore.set(target, metadata);
  }

  return metadata;
}

function setClassMeta(target: Function, key: symbol, value: unknown): void {
  getMetadata(target).values.set(key, value);
}

function getClassMeta(target: Function, key: symbol): unknown {
  return getMetadata(target).values.get(key);
}

function setPropertyMeta(
  target: Function,
  property: string | symbol,
  key: symbol,
  value: unknown
): void {
  const metadata = getMetadata(target);

  let propertyMetadata = metadata.properties.get(property);

  if (!propertyMetadata) {
    propertyMetadata = new Map();
    metadata.properties.set(property, propertyMetadata);
  }
  propertyMetadata.set(key, value);
}

function getPropertyMeta(
  target: Function,
  property: string | symbol,
  key: symbol
): unknown {
  return getMetadata(target).properties.get(property)?.get(key);
}

export function EntityRepository<T>(entity: new () => T) {
  return function (target: Function, _context: ClassDecoratorContext): void {
    setClassMeta(target, repositoryMetadataKey, entity);
    setClassMeta(entity, entityMetadataKey, entity);
  };
}

export function DbSetEntity<T>(entity: new () => T) {
  return function (
    _value: undefined,
    context: ClassFieldDecoratorContext
  ): void {
    context.addInitializer(function () {
      const ctor = (this as any).constructor as Function;

      setPropertyMeta(ctor, context.name, repositoryMetadataKey, entity);

      // Preserve previous behavior.
      if (!getClassMeta(ctor, repositoryMetadataKey)) {
        setClassMeta(ctor, repositoryMetadataKey, entity);
      }

      setClassMeta(entity, entityMetadataKey, entity);
      DbContext.__createDbSet(this as DbContext, context.name, entity);
    });
  };
}

export function getEntitySchema(target: object) {
  const ctor =
    typeof target === 'object' ? (target.constructor as Function) : target;

  return (
    getClassMeta(ctor, repositoryMetadataKey) ??
    getClassMeta(ctor, entityMetadataKey)
  );
}

export function getEntitySetKeys(target: object) {
  const ctor = target.constructor as Function;

  return getPropertyMeta(ctor, propListPropertyName, propMetadataKey) as
    (string | symbol)[] | undefined;
}

export function getEntitySet(target: object, propertyKey: string | symbol) {
  const ctor = target.constructor as Function;

  return (getPropertyMeta(ctor, propertyKey, entityMetadataKey) ??
    getPropertyMeta(ctor, propertyKey, repositoryMetadataKey)) as
    (new (...args: any[]) => any) | undefined;
}
