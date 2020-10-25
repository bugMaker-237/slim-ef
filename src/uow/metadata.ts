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
  type: new (...args) => T
): ProxyMetaDataInstance<T> {
  if (map.has(type)) return map.get(type);
  const meta = _getMetaData<T>(con, type);
  map.set(type, meta);
  return meta;
}

function _getMetaData<T>(
  con: Connection,
  type: any,
  constructorChain = [],
  basePropName = ''
): ProxyMetaDataInstance<T> {
  const meta = con.getMetadata(type);
  return _getTypeMetaData(meta, type, con, constructorChain, basePropName);
}

function _getTypeMetaData<T = any>(
  meta: EntityMetadata,
  type: any,
  con: Connection,
  constructorChain: any[],
  basePropName = ''
): ProxyMetaDataInstance<T> {
  const index = constructorChain.find(o => o.constructor === type);
  if (index >= 0) {
    const proxy = constructorChain[index];
    return proxy;
  }
  let instance = _getInstanceWithColumnsMetadata(meta, type, basePropName);

  instance = _getInstanceWithRelationsMetadata(
    con,
    meta,
    instance,
    type,
    constructorChain,
    basePropName
  );
  return instance;
}

function _getInstanceWithRelationsMetadata(
  con: Connection,
  metaData: EntityMetadata,
  previousInstance: any,
  type: any,
  constructorChain: any[],
  basePropName = ''
): ProxyMetaDataInstance<any> {
  const instance = new type();

  Object.assign(instance, previousInstance);

  if (constructorChain.findIndex(o => o.constructor === type) < 0)
    constructorChain.push(instance);

  let toAssign;

  for (const c of metaData.relations) {
    toAssign = {
      $$propertyName: basePropName
        ? `${basePropName}.${c.propertyName}`
        : c.propertyName
    };
    const subType = new (c.type as any)();
    if (c.isOneToMany) {
      // handling one to many as array since the type in target is Array
      const arrProxy = new SelectArrayProxy(toAssign.$$propertyName);
      instance[c.propertyName] = arrProxy;
      let meta: any = {};
      const i = constructorChain.findIndex(o => o.constructor === c.type);
      if (i < 0) {
        meta = _getMetaData(
          con,
          c.type,
          constructorChain,
          toAssign.$$propertyName
        );
      } else {
        // cloning the object for it not to have same ref as others
        meta = constructorChain.find(o => o.constructor === c.type);
      }
      Object.assign(subType, toAssign, meta);

      instance[c.propertyName].push(subType);
    } else {
      const meta = _getMetaData(
        con,
        c.type,
        constructorChain,
        toAssign.$$propertyName
      );
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
