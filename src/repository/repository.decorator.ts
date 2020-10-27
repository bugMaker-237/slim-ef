const repositoryMetadataKey = Symbol('entityRepository:key');
const entityMetadataKey = Symbol('entity:key');
const propMetadataKey = Symbol('prop:key');
const propListPropertyName = 'prop:list';

export function EntityRepository<T>(entity: (new () => T) | (() => void)) {
  return (target: any) => {
    Reflect.defineMetadata(repositoryMetadataKey, entity, target.constructor);
    Reflect.defineMetadata(entityMetadataKey, entity, entity);
  };
}

export function DbSetEntity<T>(entity: (new () => T) | (() => void)) {
  return (target: any, propertykey: string) => {
    Reflect.defineMetadata(
      repositoryMetadataKey,
      entity,
      target.constructor,
      propertykey
    );
    const props =
      Reflect.getOwnMetadata(
        propMetadataKey,
        target.constructor,
        propListPropertyName
      ) || [];
    props.push(propertykey);
    Reflect.defineMetadata(
      propMetadataKey,
      props,
      target.constructor,
      propListPropertyName
    );

    EntityRepository(entity)(target);
  };
}

export function getEntitySchema(target: any) {
  return (
    Reflect.getOwnMetadata(repositoryMetadataKey, target.constructor) ||
    Reflect.getOwnMetadata(entityMetadataKey, target.constructor) ||
    Reflect.getOwnMetadata(repositoryMetadataKey, target) ||
    Reflect.getOwnMetadata(entityMetadataKey, target)
  );
}

export function getEntitySetKeys(target: any) {
  return Reflect.getOwnMetadata(
    propMetadataKey,
    target.constructor,
    propListPropertyName
  );
}

export function getEntitySet(target: any, propertykey: string) {
  return (
    Reflect.getOwnMetadata(
      entityMetadataKey,
      target.constructor,
      propertykey
    ) ||
    Reflect.getOwnMetadata(
      repositoryMetadataKey,
      target.constructor,
      propertykey
    )
  );
}
