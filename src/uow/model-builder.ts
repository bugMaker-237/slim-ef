import { SlimExpressionFunction } from 'slim-exp';
import { IQueryable } from '../repository';
let ModelsFilterMap = new WeakMap();
const GlobalFilterKey = { undefined };
export class ModelBuilder<I extends object = any> {
  private _currentType: any = GlobalFilterKey;
  entity<T extends object>(type: new () => T): ModelBuilder<T> {
    if (ModelsFilterMap.has(type)) {
      return;
    }
    this._currentType = type;
    return this as any;
  }

  hasQueryFilter(exp: SlimExpressionFunction<I>): ModelBuilder<I> {
    let expMap = [];
    if (ModelsFilterMap.has(this._currentType)) {
      expMap = ModelsFilterMap.get(this._currentType);
    }
    expMap.push(exp);
    ModelsFilterMap.delete(this._currentType);
    ModelsFilterMap.set(this._currentType, expMap);
    this._currentType = GlobalFilterKey;
    return this;
  }

  resetAllFilters(): void {
    this._currentType = GlobalFilterKey;
    ModelsFilterMap = new WeakMap();
  }

  resetFilterFor<T>(type: new () => T): void {
    ModelsFilterMap.delete(this._currentType);
    this._currentType = GlobalFilterKey;
  }

  getFilters(type: any): SlimExpressionFunction<I>[] {
    const filters = [];
    if (ModelsFilterMap.has(type)) {
      filters.push(ModelsFilterMap.get(type));
    }
    if (ModelsFilterMap.has(GlobalFilterKey)) {
      filters.push(ModelsFilterMap.get(GlobalFilterKey));
    }
    return filters;
  }
}
