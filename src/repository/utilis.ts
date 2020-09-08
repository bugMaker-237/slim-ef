import { DeepPartial } from 'typeorm';

function __patch<T>(entityShema: new () => T, entity: DeepPartial<T>): T {
  const t = new entityShema();
  if (t.constructor !== entity.constructor) {
    Object.assign(t, entity);
    return t;
  }
  return entity as T;
}

export function patch<T>(entityShema: new () => T) {
  return (entity: DeepPartial<T>): T => {
    return __patch(entityShema, entity);
  };
}

export function patchM<T>(entityShema: new () => T) {
  return (...entities: DeepPartial<T>[]): T[] => {
    return entities.map((e) => __patch(entityShema, e));
  };
}
