import {
  CriteriaExpression,
  FieldsSelector,
  FunctionQueryType,
  IQuerySpecificationEvaluator,
  ISpecification,
  QueryType
} from '@slim-ef/core';
import {
  AstExpression,
  ISlimExpression,
  PrimitiveValueTypes as PrimitiveTypes,
  SlimExpression,
  SlimExpressionFunction
} from 'slim-exp';
import {
  Brackets,
  ObjectLiteral,
  SelectQueryBuilder,
  WhereExpressionBuilder
} from 'typeorm';
import { SQLQuerySpecificationException } from './exception';
import {
  ComparisonOperators,
  convertToSqlComparisonOperator,
  format,
  SQLArrayFunctions,
  SQLConstants,
  SQLJoinFunctions,
  SQLStringFunctions
} from './utils';
const INITIAL_ALIAS = 'entity';
type WhereQuery<T extends ObjectLiteral> = (
  where: Brackets | string | ((qb: SelectQueryBuilder<T>) => string),
  params?: Record<string, any>
) => SelectQueryBuilder<T>;

export class SQLQuerySpecificationEvaluator<
  T extends ObjectLiteral
> implements IQuerySpecificationEvaluator<T> {
  private registerdAliases = [INITIAL_ALIAS];
  private _query!: SelectQueryBuilder<T>;
  private _queryReady: boolean = false;
  private _discriminator: number = 0;
  private _selectBuilder?: SlimExpressionFunction<T, any, any>;
  private _distinctSelectFields: { property: string; alias: string }[] = [];

  constructor(
    private readonly initialQuery: (alias: string) => SelectQueryBuilder<T>,
    private readonly spec: ISpecification<T>
  ) {
    this._queryReady = false;
  }

  _applyLeftJoin(
    query: SelectQueryBuilder<T>,
    intialAlias: string,
    exp: SlimExpressionFunction<T> | string
  ) {
    return this._applyJoin(query.leftJoinAndSelect, query, intialAlias, exp);
  }

  private _applyJoin(
    toApply: (...args: any[]) => any,
    query: SelectQueryBuilder<T>,
    intialAlias: string,
    exp: SlimExpressionFunction<T> | string
  ) {
    const name = typeof exp === 'string' ? exp : SlimExpression.nameOf(exp); // expressionParser will parse property name as empty if trying to parse obj => obj
    if (!name.trim())
      throw new SQLQuerySpecificationException(
        'You are trying to include self entity'
      );
    const { isAlreadyRegistered, propertyName, entityAlias } =
      this._getFieldNameAndAlias(intialAlias, name);
    if (!isAlreadyRegistered) toApply.call(query, propertyName, entityAlias);
    return { propertyName, entityAlias };
  }

  private _getFieldNameAndAlias(
    alias: string,
    name: string,
    handlingFunction = false
  ) {
    const splitted = name.split('.');
    if (splitted.length >= 2 && !handlingFunction)
      throw new SQLQuerySpecificationException(
        'Include or Where syntax error. Use thenInclude to include composite entity'
      );
    name = splitted[0];
    const entityAlias = `${alias}_${name}`;

    const isAlreadyRegistered = this.registerdAliases.includes(entityAlias);
    if (!isAlreadyRegistered && !handlingFunction) {
      if (!handlingFunction) this.registerdAliases.push(entityAlias);
      else
        throw new SQLQuerySpecificationException(
          'Include or Where syntax error. Use thenInclude to include composite entity'
        );
    }

    return {
      propertyName: `${alias}.${name}`,
      entityAlias: handlingFunction
        ? `${alias}_${splitted.join('_')}`
        : entityAlias,
      isAlreadyRegistered
    };
  }

  private _getPropertyAlias(f: SlimExpressionFunction<T, any, any> | string) {
    const name = typeof f === 'string' ? f : SlimExpression.nameOf(f);
    if (!name.trim())
      throw new SQLQuerySpecificationException(
        'You are trying to apply boolean condition on self entity'
      );
    const propertyAlias = this._getFieldFromRegisteredAlias(
      INITIAL_ALIAS,
      name
    );
    return propertyAlias;
  }

  private _getFieldFromRegisteredAlias(initialAlias: string, name: string) {
    const path = name.split('.');
    let finalAlias = initialAlias;
    const finalName = path.pop();
    if (path.length !== 0) {
      finalAlias += `_${path.join('_')}`;
    }
    if (!this.registerdAliases.includes(finalAlias))
      throw new SQLQuerySpecificationException(
        "Condition added to where clause with a property that was not included in the query expression.Please use 'include' with/or 'thenInclude' to include desire entity: " +
          finalAlias
      );
    return `${finalAlias}.${finalName}`;
  }

  private _isOrBinding(val: string) {
    return val === '||' || val === '|';
  }

  private _generateQuery(
    alias: string,
    sqlQuery: SelectQueryBuilder<T>,
    selector: CriteriaExpression<T>,
    isFirst = false
  ): SelectQueryBuilder<T> {
    try {
      const exp = new SlimExpression<T>();
      exp.fromAction(selector.func, selector.context, false);
      const ast = exp.compileAst();
      const toApply = isFirst ? sqlQuery.where : sqlQuery.andWhere;
      // applying brackets around each where clause to improve consistency
      // and fiability of the request
      const brackets = new Brackets(wh => {
        this._buildFromAst(
          ast,
          wh,
          alias,
          exp,
          SelectQueryBuilder.prototype.where
        );
      });
      toApply.call(sqlQuery, brackets);
      return sqlQuery;
    } catch (error: Error | any) {
      throw new SQLQuerySpecificationException(
        (error?.message ?? '') +
          '; func:' +
          selector.func.toString() +
          '; context: ' +
          (selector.context ? JSON.stringify(selector.context) : '')
      );
    }
  }

  private _buildFromAst(
    ast: AstExpression,
    sqlQuery: WhereExpressionBuilder,
    alias: string,
    exp: ISlimExpression<any, any, any>,
    toApply: WhereQuery<T>
  ): WhereExpressionBuilder {
    try {
      switch (ast.kind) {
        case 'GroupExpression':
          this._applyGroup(ast, sqlQuery, alias, exp, toApply);
          break;
        case 'BinaryExpression':
          if (ast.operator === '&&' || ast.operator === '||') {
            this._buildFromAst(ast.left, sqlQuery, alias, exp, toApply);
            this._buildFromAst(
              ast.right,
              sqlQuery,
              alias,
              exp,
              this._isOrBinding(ast.operator)
                ? SelectQueryBuilder.prototype.orWhere
                : SelectQueryBuilder.prototype.andWhere
            );
          } else {
            this._applyComparison(ast, sqlQuery, alias, exp, toApply);
          }
          break;
        case 'UnaryExpression':
        case 'CallExpression':
        case 'MemberExpression':
          this._applyLeaf(ast, sqlQuery, alias, exp, toApply);
          break;
        default:
          break;
      }

      return sqlQuery;
    } catch (error: Error | any) {
      throw new SQLQuerySpecificationException(error.message);
    }
  }

  private _applyGroup(
    ast: AstExpression,
    sqlQuery: WhereExpressionBuilder,
    alias: string,
    exp: ISlimExpression<any, any, any>,
    toApply: WhereQuery<T>
  ) {
    if (ast.kind !== 'GroupExpression') return;
    const brackets = new Brackets(wh => {
      this._buildFromAst(
        ast.expression,
        wh,
        alias,
        exp,
        SelectQueryBuilder.prototype.where
      );
    });
    toApply.call(sqlQuery, brackets);
  }

  private _applyComparison(
    ast: AstExpression,
    sqlQuery: WhereExpressionBuilder,
    alias: string,
    exp: ISlimExpression<any, any, any>,
    toApply: WhereQuery<T>
  ) {
    if (ast.kind !== 'BinaryExpression') return;
    const operator = ast.operator;
    const { target: leftTarget } = this._unwrapUnary(ast.left);

    // function call on the left side (i.e `p => p.firstname.startsWith(...)`)
    if (leftTarget.kind === 'CallExpression') {
      this._applyCall(leftTarget, sqlQuery, alias, exp, toApply);
      return;
    }

    if (leftTarget.kind !== 'MemberExpression') {
      throw new Error('Unsupported left hand side expression');
    }

    const lhsName = this._getMemberColumn(leftTarget, alias, exp);
    const right = ast.right;

    if (right.kind === 'Literal') {
      this._applyLiteralComparison(lhsName, operator, right, sqlQuery, toApply);
      return;
    }

    if (right.kind === 'MemberExpression') {
      const path = this._extractPropertyPath(right);
      if (!path) throw new Error('Unsupported right hand side expression');
      if (path[0] === exp.contextName && exp.contextName) {
        const value = this._resolveContextValue(path, exp);
        this._applyValueComparison(
          lhsName,
          operator,
          value,
          this._typeOf(value),
          path[path.length - 1],
          sqlQuery,
          toApply
        );
        return;
      }
      const rhsName = this._getMemberColumn(right, alias, exp);
      toApply.call(
        sqlQuery,
        ` ${lhsName} ${convertToSqlComparisonOperator(operator)} ${rhsName}`
      );
      return;
    }

    throw new Error('Unsupported right hand side expression');
  }

  private _applyLeaf(
    ast: AstExpression,
    sqlQuery: WhereExpressionBuilder,
    alias: string,
    exp: ISlimExpression<any, any, any>,
    toApply: WhereQuery<T>
  ) {
    const { suffix, target } = this._unwrapUnary(ast);

    if (target.kind === 'CallExpression') {
      this._applyCall(target, sqlQuery, alias, exp, toApply);
      return;
    }

    if (target.kind === 'MemberExpression') {
      const path = this._extractPropertyPath(target);
      if (path && path[0] === exp.contextName && exp.contextName) {
        throw new SQLQuerySpecificationException(
          'Expression has to start with type member invocation'
        );
      }
      const column = this._getMemberColumn(target, alias, exp);
      toApply.call(
        sqlQuery,
        ` ${column} ${convertToSqlComparisonOperator(
          ComparisonOperators.EQUAL_TO
        )} ${suffix === '!' ? SQLConstants.FALSE : SQLConstants.TRUE}`
      );
      return;
    }
  }

  private _applyCall(
    ast: AstExpression,
    sqlQuery: WhereExpressionBuilder,
    alias: string,
    exp: ISlimExpression<any, any, any>,
    toApply: WhereQuery<T>
  ) {
    if (ast.kind !== 'CallExpression') return;
    const callee = ast.callee;
    if (callee.kind !== 'MemberExpression') {
      throw new Error('Unsupported Function Invokation: invalid callee');
    }
    const methodName = callee.property;
    const path = this._extractPropertyPath(callee.object);
    if (!path) {
      throw new Error('Unsupported Function Invokation: invalid object');
    }
    const localPath = path.slice(1);
    const propName = this._getFieldFromRegisteredAlias(
      alias,
      localPath.join('.')
    );
    const firstArg = ast.arguments[0];

    const getStringFunction = (methodName: string) =>
      (SQLStringFunctions as Record<string, string>)[methodName];
    const getArrayFunction = (methodName: string) =>
      (SQLArrayFunctions as Record<string, string>)[methodName];

    if (
      methodName in SQLStringFunctions &&
      firstArg &&
      firstArg.kind !== 'FunctionExpression'
    ) {
      const value = this._resolveValue(firstArg, exp);
      const func = getStringFunction(methodName);
      const sqlPart = format(func, propName, value.toString());
      toApply.call(sqlQuery, sqlPart);
      return;
    }

    if (
      methodName in SQLArrayFunctions &&
      firstArg &&
      firstArg.kind !== 'FunctionExpression'
    ) {
      const value = this._resolveValue(firstArg, exp);
      if (Array.isArray(value) && value.length > 0) {
        const func = getArrayFunction(methodName);
        const tb = value.map((v: any) => `'${v}'`);
        const sqlPart = format(func, propName, tb.toString());
        toApply.call(sqlQuery, sqlPart);
        return;
      }
    }

    if (
      methodName in SQLJoinFunctions &&
      firstArg &&
      firstArg.kind === 'FunctionExpression'
    ) {
      const { entityAlias } = this._getFieldNameAndAlias(
        alias,
        localPath.join('.'),
        true
      );
      const child = this._compileFunctionSource(firstArg.source, exp);
      const childAst = child.compileAst();
      this._buildFromAst(childAst, sqlQuery, entityAlias, child, toApply);
      return;
    }

    throw new Error('Unsupported Function Invokation: ' + methodName);
  }

  private _applyLiteralComparison(
    lhsName: string,
    operator: string,
    literal: AstExpression,
    sqlQuery: WhereExpressionBuilder,
    toApply: WhereQuery<T>
  ) {
    if (literal.kind !== 'Literal') return;
    const { type, value } = this._toLegacyType(
      literal.value,
      literal.valueType
    );
    this._applyValueComparison(
      lhsName,
      operator,
      value,
      type,
      '[CONSTANT]',
      sqlQuery,
      toApply
    );
  }

  private _applyValueComparison(
    lhsName: string,
    operator: string,
    value: any,
    propertyType: string,
    propertyName: string,
    sqlQuery: WhereExpressionBuilder,
    toApply: WhereQuery<T>
  ) {
    const paramName = this._getUniqueParamName(propertyName);
    const queryStr = ` ${lhsName} ${convertToSqlComparisonOperator(
      operator,
      value
    )} :${paramName}`;
    const queryParams: Record<string, any> = {};
    const propValue = value as any;
    // we need to format the date because typeorm has issue handling it with
    // sqlite
    queryParams[paramName] =
      propertyType === PrimitiveTypes.date
        ? this._polyfillDate(propValue)
        : propertyType === PrimitiveTypes.number
          ? propValue.toString()
          : propValue;
    toApply.call(sqlQuery, queryStr, queryParams);
  }

  private _compileFunctionSource(
    source: string,
    parentExp: ISlimExpression<any, any, any>
  ): SlimExpression<any, any, any> {
    const fn = new Function(
      'return (' + source + ')'
    )() as SlimExpressionFunction<any, any, any>;
    const child = new SlimExpression();
    child.fromAction(fn, parentExp.context, false);
    return child;
  }

  private _unwrapUnary(ast: AstExpression): {
    suffix: string;
    target: AstExpression;
  } {
    let count = 0;
    let current = ast;
    while (current.kind === 'UnaryExpression') {
      current = current.argument;
      count++;
    }
    return { suffix: '!'.repeat(count), target: current };
  }

  private _extractPropertyPath(node: AstExpression): string[] | null {
    if (node.kind === 'Identifier') return [node.name];
    if (node.kind !== 'MemberExpression') return null;
    const object = this._extractPropertyPath(node.object);
    if (!object) return null;
    return [...object, node.property];
  }

  private _getMemberColumn(
    node: AstExpression,
    alias: string,
    exp: ISlimExpression<any, any, any>
  ): string {
    const path = this._extractPropertyPath(node);
    if (!path || path.length < 2) {
      throw new SQLQuerySpecificationException(
        'Expression has to start with type member invocation'
      );
    }
    if (path[0] === exp.contextName && exp.contextName) {
      throw new SQLQuerySpecificationException(
        'Context member cannot be used as a column'
      );
    }
    return this._getFieldFromRegisteredAlias(alias, path.slice(1).join('.'));
  }

  private _resolveValue(
    node: AstExpression,
    exp: ISlimExpression<any, any, any>
  ): any {
    if (node.kind === 'Literal') {
      const { value } = this._toLegacyType(node.value, node.valueType);
      return value;
    }
    if (node.kind === 'MemberExpression') {
      const path = this._extractPropertyPath(node);
      if (path && path[0] === exp.contextName && exp.contextName) {
        return this._resolveContextValue(path, exp);
      }
    }
    throw new SQLQuerySpecificationException('Unsupported value expression');
  }

  private _resolveContextValue(
    path: string[],
    exp: ISlimExpression<any, any, any>
  ): any {
    const context: any = exp.context ?? {};
    let value: any = context[path[1]];
    for (let i = 2; i < path.length; i++) {
      if (value == null) break;
      value = value[path[i]];
    }
    return value;
  }

  private _toLegacyType(
    value: any,
    valueType?: string
  ): { type: string; value: any } {
    if (typeof value === 'string') {
      const parsed = new Date(value);
      if (!isNaN(parsed.getTime())) {
        return { type: 'date', value: parsed };
      }
    }
    return { type: valueType ?? typeof value, value };
  }

  private _typeOf(value: any): string {
    return value instanceof Date ? 'date' : typeof value;
  }

  private _polyfillDate(val: Date): any {
    const pad = (num: number, p = 2, bf = true) =>
      bf ? num.toString().padStart(p, '0') : num.toString().padEnd(p, '0');

    return `${val.getFullYear()}-${pad(val.getMonth() + 1)}-${pad(
      val.getDate()
    )} ${pad(val.getHours())}-${pad(val.getMinutes())}-${pad(
      val.getSeconds()
    )}.${pad(val.getMilliseconds(), 3, false)}`;
  }

  private _getUniqueParamName(paramName: string): string {
    paramName = paramName.replace(/\[|\]|\(|\)|\*|\+|\-|\'|\"/g, '');

    return paramName + '_' + ++this._discriminator;
  }

  public getParams(): any {
    return this._query.getParameters();
  }
  public getQuery<R extends object>(): Promise<string> {
    return new Promise((res, rej) => {
      try {
        this._query = this.initialQuery(INITIAL_ALIAS).select();
        // tslint:disable-next-line: one-variable-per-declaration
        const includes = this.spec.getIncludes(),
          chainedIncludes = this.spec.getChainedIncludes(),
          criterias = this.spec.getCriterias(),
          orderBy = this.spec.getOrderBy(),
          groupBy = this.spec.getGroupBy(),
          thenGroupBy = this.spec.getThenGroupBy(),
          orderByDescending = this.spec.getOrderByDescending(),
          selector = this.spec.getSelector<R>(),
          take = this.spec.getTake(),
          skip = this.spec.getSkip(),
          thenOrderBy = this.spec.getThenOrderBy(),
          isPagingEnabled = this.spec.getIsPagingEnabled(),
          func = this.spec.getFunction(),
          isDistinct = this.spec.getDistinct();

        if (chainedIncludes && chainedIncludes.length > 0) {
          for (const i of chainedIncludes) {
            let { entityAlias: currentAlias } = this._applyLeftJoin(
              this._query,
              INITIAL_ALIAS,
              i.initial
            );
            i.chain.forEach(c => {
              const { entityAlias } = this._applyLeftJoin(
                this._query,
                currentAlias,
                c
              );
              currentAlias = entityAlias;
            });
          }
        }

        if (includes && includes.length > 0) {
          for (const i of includes) {
            this._applyLeftJoin(this._query, INITIAL_ALIAS, i);
          }
        }

        if (criterias && criterias.length > 0) {
          const [first, ...rest] = criterias;

          this._query = this._generateQuery(
            INITIAL_ALIAS,
            this._query,
            first,
            true
          );
          if (rest && rest.length > 0) {
            for (const q of rest) {
              this._query = this._generateQuery(INITIAL_ALIAS, this._query, q);
            }
          }
        }

        if (func) {
          this._query = this._applyFunction(this._query, func);
        } else {
          let propertyAlias;
          let isAsc = false;
          if (orderBy) {
            propertyAlias = this._getPropertyAlias(orderBy);
            isAsc = true;
            this._query = this._query.orderBy(propertyAlias, 'ASC');
          } else if (orderByDescending) {
            propertyAlias = this._getPropertyAlias(orderByDescending);
            this._query = this._query.orderBy(propertyAlias, 'DESC');
          }

          if ((orderBy || orderByDescending) && thenOrderBy?.length) {
            thenOrderBy.forEach(tb => {
              propertyAlias = this._getPropertyAlias(tb);
              this._query = this._query.addOrderBy(
                propertyAlias,
                isAsc ? 'ASC' : 'DESC'
              );
            });
          }

          if (groupBy) {
            propertyAlias = this._getPropertyAlias(groupBy);
            this._query = this._query.groupBy(propertyAlias);
          }

          if (groupBy && thenGroupBy?.length) {
            thenGroupBy.forEach(tb => {
              propertyAlias = this._getPropertyAlias(tb);
              this._query = this._query.addGroupBy(propertyAlias);
            });
          }
          if (isPagingEnabled) {
            if (take) {
              this._query = this._query.take(take);
            }
            if (skip) {
              this._query = this._query.skip(skip);
            }
          }

          if (isDistinct) {
            this._query = this._query.distinct(true);
          }

          if (
            selector &&
            selector.fieldsToSelect &&
            selector.fieldsToSelect.length > 0
          ) {
            const toSelect = this._buildSelect(
              this._query,
              selector,
              isDistinct
            );
            this._query.select(toSelect);
            this._selectBuilder = selector.builder;
            if (isDistinct) {
              this._distinctSelectFields = (selector.fieldsToSelect || []).map(
                f => {
                  const propertyAlias = this._getPropertyAlias(f.field);
                  return {
                    property: f.field as string,
                    alias: propertyAlias.replace(/\./g, '_')
                  };
                }
              );
            }
          }
        }
        this._queryReady = true;
        return res(this._query.getQuery());
      } catch (error: Error | any) {
        throw new SQLQuerySpecificationException(error);
      }
    });
  }
  private _buildSelect(
    _query: SelectQueryBuilder<T>,
    selector: FieldsSelector<T>,
    isDistinct = false
  ): string[] {
    const toSelect = [
      ...(selector.fieldsToSelect || []).map(f =>
        this._getPropertyAlias(f.field)
      )
    ];

    // Distinct projections must only contain the projected columns, otherwise
    // the primary/foreign keys make every row unique and DISTINCT becomes a no-op.
    if (!isDistinct) {
      // If id is not present typeorm throws an exception.
      // So we go get the id field

      if (this._query.expressionMap.mainAlias) {
        for (const c of this._query.expressionMap.mainAlias.metadata.columns) {
          if (c.isPrimary) {
            toSelect.push(
              this._getFieldFromRegisteredAlias(INITIAL_ALIAS, c.propertyName)
            );
            break;
          }
        }
      }

      // I didn't find any other way to add the realtionsId to
      // the select query.
      // If the relations' id are not present in the select query
      // the entities will not be loaded by typeorm
      for (const j of this._query.expressionMap.joinAttributes) {
        const propName = j.alias.name.split('_');
        propName.pop();
        const finalName = propName.join('_');
        if (j.relation) {
          for (const f of j.relation.foreignKeys) {
            for (const c of f.columnNames) {
              toSelect.push(this._getFieldFromRegisteredAlias(finalName, c));
            }
          }
        }
      }
    }
    // A column may be referenced by the fields selector, the primary key and
    // the relations' foreign keys. Avoid emitting the same column several times.
    return [...new Set(toSelect)];
  }
  private _applyFunction(
    query: SelectQueryBuilder<T>,
    value: {
      type: FunctionQueryType;
      func?: SlimExpressionFunction<T>;
    }
  ): SelectQueryBuilder<T> {
    const field = value.func ? this._getPropertyAlias(value.func) : '*';
    return query.select(`${value.type}(${field}) as ${value.type}`);
  }

  public async executeQuery<R extends object = T, Q = R[]>(
    type: QueryType
  ): Promise<Q> {
    if (!this._queryReady) await this.getQuery<R>();
    let toApply;
    let defaultVal;

    // Distinct projections must be fetched with getRawMany: typeorm's getMany()
    // re-hydrates the entities for the joins and produces duplicate rows that
    // defeat the SELECT DISTINCT. Raw rows expose the aliased column names, so
    // they are reshaped to the projected property names before the builder runs.
    if (this._distinctSelectFields.length > 0) {
      toApply = this._query.getRawMany;
      defaultVal = [];
    } else {
      switch (type) {
        case QueryType.ALL:
          toApply = this._query.getMany;
          defaultVal = [];
          break;
        case QueryType.ONE:
          toApply = this._query.getOne;
          defaultVal = void 0;
          break;
        case QueryType.RAW_ONE:
          toApply = this._query.getRawOne;
          defaultVal = void 0;
          break;
        case QueryType.RAW_ALL:
        default:
          toApply = this._query.getRawMany;
          defaultVal = [];
          break;
      }
    }
    const result = (await toApply.call(this._query)) || defaultVal;
    let finalRes: any;
    if (this._selectBuilder) {
      if (this._distinctSelectFields.length > 0) {
        const fields = this._distinctSelectFields;
        finalRes = (result as any[]).map((r: any) => {
          const entityShape: Record<string, any> = {};
          for (const f of fields) {
            entityShape[f.property] = r[f.alias];
          }
          return this._selectBuilder!(entityShape as any);
        });
      } else {
        finalRes = Array.isArray(result)
          ? result.map(r => this._selectBuilder!(r))
          : this._selectBuilder(result as any);
      }
    } else {
      finalRes = result;
    }
    return finalRes;
  }
}
