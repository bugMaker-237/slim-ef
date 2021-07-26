import { SlimExpressionFunction } from 'slim-exp';
import { IQueryable, QueryRefiner } from '../repository';
const GlobalMapKey = {
  name: Symbol('GlobalMapKey')
};

export class DbContextModelBuilder<I extends object = any> {
  private _modelsFilterMap = new WeakMap<object, any[]>();
  private _currentType: any = void 0;
  entity<T extends object>(type: new () => T): DbContextModelBuilder<T> {
    this._currentType = type;
    return this as any;
  }

  hasQueryFilter(query: QueryRefiner<I>): DbContextModelBuilder<I> {
    let expMap = [];
    if (this._modelsFilterMap.has(this._currentType)) {
      expMap = this._modelsFilterMap.get(this._currentType);
    }
    expMap.push(query);
    this._modelsFilterMap.delete(this._currentType);
    this._modelsFilterMap.set(this._currentType, expMap);
    this._currentType = void 0;
    return this;
  }

  hasGlobalQueryFilter<R extends object = any>(query: QueryRefiner<R>) {
    const oldType = this._currentType;
    this._currentType = GlobalMapKey;
    this.hasQueryFilter(query as QueryRefiner<any>);
    this._currentType = oldType;
  }
  resetAllFilters(): void {
    this._currentType = void 0;
    this._modelsFilterMap = new WeakMap();
  }

  resetFilterFor<T>(type: new () => T): void {
    this._modelsFilterMap.delete(this._currentType);
    this._currentType = void 0;
  }

  getFilters(type: any): SlimExpressionFunction<I>[] {
    const filters = [];
    if (this._modelsFilterMap.has(type)) {
      filters.push(...this._modelsFilterMap.get(type));
    }
    if (this._modelsFilterMap.has(GlobalMapKey)) {
      filters.push(...this._modelsFilterMap.get(GlobalMapKey));
    }
    return filters;
  }
}
