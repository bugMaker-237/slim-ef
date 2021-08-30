import { Connection, EntityMetadata } from 'typeorm';
import {
  SelectArrayProxy,
  SelectBooleanProxy,
  SelectNumberProxy,
  SelectStringProxy
} from './metadata-proxy';
import { ProxyMetaDataInstance } from './_internal.interface';

const map = new WeakMap();

export function getMetaData<T>(
  con: Connection,
  type: new (...args: any[]) => T
): ProxyMetaDataInstance<T> {
  if (map.has(type)) return map.get(type);
  const meta = _getMetaData<T>(con, type);
  map.set(type, meta);
  return meta;
}

function _getMetaData<T>(
  con: Connection,
  type: any,
  basePropName = ''
): ProxyMetaDataInstance<T> {
  const meta = con.getMetadata(type);
  return _getTypeMetaData(meta, type, con, basePropName);
}

function _getTypeMetaData<T = any>(
  meta: EntityMetadata,
  type: any,
  con: Connection,
  basePropName = ''
): ProxyMetaDataInstance<T> {
  if (map.has(type)) {
    return map.get(type);
  }
  let instance = _getInstanceWithColumnsMetadata(meta, type, basePropName);

  instance = _getInstanceWithRelationsMetadata(
    con,
    meta,
    instance,
    type,
    basePropName
  );
  return instance;
}

function _getInstanceWithRelationsMetadata(
  con: Connection,
  metaData: EntityMetadata,
  previousInstance: any,
  type: any,
  basePropName = ''
): ProxyMetaDataInstance<any> {
  const instance = new type();

  Object.assign(instance, previousInstance);

  if (!map.has(type)) map.set(type, instance);

  let toAssign: { $$propertyName: string };

  for (const c of metaData.relations) {
    toAssign = {
      $$propertyName: basePropName
        ? `${basePropName}.${c.propertyName}`
        : c.propertyName
    };
    const subType = new (c as any).type();
    let meta = {};

    if (map.has(type)) {
      meta = map.get(type);
    } else {
      meta = _getMetaData(con, c.type, toAssign.$$propertyName);
    }

    if (c.isOneToMany) {
      // handling one to many as array since the type in target is Array
      const arrProxy = new SelectArrayProxy(toAssign.$$propertyName);
      instance[c.propertyName] = arrProxy;

      Object.assign(subType, toAssign, meta);
      instance[c.propertyName].push(subType);
    } else {
      meta = _getMetaData(con, c.type, toAssign.$$propertyName);
      Object.assign(subType, toAssign, meta);
      instance[c.propertyName] = subType;
    }
  }
  return instance;
}

function _getInstanceWithColumnsMetadata(
  metaData: EntityMetadata,
  type: any,
  basePropName = ''
) {
  const instance = new type();
  for (const c of metaData.columns) {
    const realProp = basePropName
      ? `${basePropName}.${c.propertyName}`
      : c.propertyName;
    if (c.type === Number) {
      instance[c.propertyName] = new SelectNumberProxy(realProp);
    } else if (c.type === Boolean) {
      instance[c.propertyName] = new SelectBooleanProxy(realProp);
    } else {
      instance[c.propertyName] = new SelectStringProxy(realProp);
    }
  }
  return instance;
}
