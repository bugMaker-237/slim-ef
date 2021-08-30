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
  type: new (...args) => T,
  includePaths: string[]
): ProxyMetaDataInstance<T> {
  // if (map.has(type)) return map.get(type);
  // const meta = _getMetaData<T>(con, type, [], '', includePaths);
  // map.set(type, meta);
  // TODO: Find a way to cache this with the include paths
  return _getMetaData<T>(con, type, [], '', includePaths);
}

function _getMetaData<T>(
  con: Connection,
  type: any,
  constructorChain = [],
  basePropName = '',
  includePaths: string[] = []
): ProxyMetaDataInstance<T> {
  const meta = con.getMetadata(type);
  // TODO: find a way to better cache the constructor chain.
  return _getTypeMetaData(
    meta,
    type,
    con,
    constructorChain,
    basePropName,
    includePaths
  );
}

function _getTypeMetaData<T = any>(
  meta: EntityMetadata,
  type: any,
  con: Connection,
  constructorChain: any[],
  basePropName = '',
  includePaths: string[] = []
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
    basePropName,
    includePaths
  );
  return instance;
}

function _getInstanceWithRelationsMetadata(
  con: Connection,
  metaData: EntityMetadata,
  previousInstance: any,
  type: any,
  constructorChain: any[],
  basePropName = '',
  includePaths: string[] = []
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
    const subType = new (c as any).type();
    let meta;
    const i = constructorChain.findIndex(o => o.constructor === c.type);
    if (i >= 0) {
      meta = constructorChain[i];
    } else {
      if (includePaths.includes(toAssign.$$propertyName)) {
        meta = _getMetaData(
          con,
          c.type,
          constructorChain,
          toAssign.$$propertyName,
          includePaths
        );
      }
    }
    if (meta) {
      if (c.isOneToMany) {
        // handling one to many as array since the type in target is Array
        const arrProxy = new SelectArrayProxy(toAssign.$$propertyName);
        instance[c.propertyName] = arrProxy;

        Object.assign(subType, toAssign, meta);
        instance[c.propertyName].push(subType);
      } else {
        Object.assign(subType, toAssign, meta);
        instance[c.propertyName] = subType;
      }
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
