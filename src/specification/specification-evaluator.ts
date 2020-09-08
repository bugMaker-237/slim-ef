import {
  ISpecification,
  CriteriaExpression,
  ISQLQuerySpecificationEvaluator,
  QueryType,
  FunctionQueryType
} from './specification.interface';
import { SelectQueryBuilder, ObjectLiteral, Brackets } from 'typeorm';
import {
  SQLConstants,
  ComparisonOperators,
  convertToSqlComparisonOperator,
  SQLStringFunctions,
  format,
  SQLArrayFunctions,
  SQLJoinFunctions
} from './utils';

import {
  SlimExpression,
  ExpressionLeftHandSide,
  ISlimExpression,
  SlimExpressionFunction,
  PrimitiveValueTypes as PrimitiveTypes
} from 'slim-exp';
import { SQLQuerySpecificationException } from './exception';
import { realpathSync } from 'fs';

const INITIAL_ALIAS = 'entity';

export class SQLQuerySpecificationEvaluator<T>
  implements ISQLQuerySpecificationEvaluator<T> {
  private registerdAliases = [INITIAL_ALIAS];
  private _query: SelectQueryBuilder<T>;

  constructor(
    private readonly initialQuery: (alias: string) => SelectQueryBuilder<T>,
    private readonly spec: ISpecification<T>
  ) {}

  private _applyLeftJoin(
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
    const {
      isAlreadyRegistered,
      propertyName,
      entityAlias
    } = this._getFieldNameAndAlias(intialAlias, name);
    if (!isAlreadyRegistered) toApply.call(query, propertyName, entityAlias);
    return { propertyName, entityAlias };
  }

  private _getFieldNameAndAlias(alias: string, name: string) {
    const splitted = name.split('.');
    if (splitted.length >= 2)
      throw new SQLQuerySpecificationException(
        'Include or Where syntax error. Use thenInclude to include composite entity'
      );
    name = splitted[0];

    const entityAlias = `${alias}_${name}`;
    const isAlreadyRegistered = this.registerdAliases.includes(entityAlias);
    if (!isAlreadyRegistered) this.registerdAliases.push(entityAlias);
    return {
      propertyName: `${alias}.${name}`,
      entityAlias,
      isAlreadyRegistered
    };
  }

  private _getPropertyAlias(f: SlimExpressionFunction<T, any, any>) {
    const name = SlimExpression.nameOf(f);
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
        "Condition added to where clause with a property that was not included in the query expression.Please use 'include' with/or 'thenInclude' to include desire entity"
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
    const exp = new SlimExpression();
    exp.fromAction(selector.func, selector.context, false);
    exp.compile();
    const toApply = isFirst ? sqlQuery.where : sqlQuery.andWhere;
    return this._chunkDownToQuery(exp, sqlQuery, alias, toApply);
  }

  private _chunkDownToQuery(
    exp: ISlimExpression<any, any, any>,
    sqlQuery: SelectQueryBuilder<T>,
    alias: ((implicitName: string) => string) | string,
    toApply: (
      where: Brackets | string | ((qb: SelectQueryBuilder<T>) => string)
    ) => SelectQueryBuilder<T>,
    closingExp?: ISlimExpression<any, any, any>,
    setupBrackets: 'opened' | 'closing' | 'inactive' = 'inactive'
  ): SelectQueryBuilder<T> {
    try {
      let e = exp;
      let brakcetsQuery = [];
      do {
        if (e.brackets?.openingExp) {
          this._chunkDownToQuery(
            e.brackets.openingExp,
            sqlQuery,
            alias,
            toApply,
            e.brackets.closingExp,
            'opened'
          );
        }

        if (e === closingExp) {
          setupBrackets = 'closing';
        }

        let queryStr = '';
        let queryParams: ObjectLiteral;
        const lhsProp = e.leftHandSide.isMethod
          ? e.leftHandSide.propertyTree
              .slice(0, e.leftHandSide.propertyTree.length - 1)
              .join('.')
          : e.leftHandSide.propertyName;
        const rhsProp = e.rightHandSide?.propertyName;

        let lhsAlias: string;
        if (typeof alias !== 'string') {
          lhsAlias = alias(e.expObjectName);
        } else {
          lhsAlias = alias;
        }
        let rhsAlias: string;
        if (e.rightHandSide) {
          if (typeof alias !== 'string') {
            rhsAlias = alias(e.rightHandSide.implicitContextName);
          } else {
            rhsAlias = alias;
          }
        }
        const lhsName = this._getFieldFromRegisteredAlias(lhsAlias, lhsProp);
        const rhsName =
          rhsProp && rhsAlias
            ? this._getFieldFromRegisteredAlias(rhsAlias, rhsProp)
            : '';

        if (
          e.leftHandSide.suffixOperator &&
          !e.leftHandSide.isMethod &&
          !e.operator &&
          !e.rightHandSide
        ) {
          const suffixOp = e.leftHandSide.suffixOperator;
          queryStr += ` ${lhsName} ${convertToSqlComparisonOperator(
            ComparisonOperators.EQUAL_TO
          )} ${suffixOp === '!' ? SQLConstants.FALSE : SQLConstants.TRUE}`;
        }

        if (e.leftHandSide.isMethod) {
          const { isHandled, sqlInvokation } = this._handleFunctionInvokation(
            lhsName,
            lhsAlias,
            e.expObjectName,
            sqlQuery,
            e.leftHandSide
          );
          if (!isHandled)
            throw new SQLQuerySpecificationException(
              'Unsupported invokable method at: ' + e.leftHandSide.propertyName
            );

          queryStr += ` ${sqlInvokation} `;
        }

        if (!e.leftHandSide.suffixOperator && e.operator && e.rightHandSide) {
          if (e.rightHandSide.propertyType !== PrimitiveTypes.undefined) {
            const paramName = this._getUniqueParamName(
              e.rightHandSide.propertyName,
              sqlQuery
            );

            queryStr += ` ${
              e.leftHandSide.isMethod ? '' : lhsName
            } ${convertToSqlComparisonOperator(e.operator)} :${paramName}`;
            queryParams = {} as any;
            queryParams[paramName] = e.rightHandSide.propertyValue;
          } else {
            queryStr += ` ${
              e.leftHandSide.isMethod ? '' : lhsName
            } ${convertToSqlComparisonOperator(e.operator)} ${rhsName}`;
          }
        }
        if (queryStr.trim()) {
          if (setupBrackets === 'inactive') {
            toApply.call(sqlQuery, queryStr, queryParams);
          } else if (setupBrackets === 'opened') {
            brakcetsQuery.push({ toApply, queryStr, queryParams });
          } else {
            const b = new Brackets(whereExp => {
              for (const {
                toApply: t,
                queryStr: q,
                queryParams: p
              } of brakcetsQuery) {
                t.call(whereExp, q, p);
              }
            });
            toApply.call(sqlQuery, b);
            brakcetsQuery = [];
            setupBrackets = 'inactive';
          }
        }

        if (e.next) {
          toApply = this._isOrBinding(e.next.bindedBy)
            ? sqlQuery.orWhere
            : sqlQuery.andWhere;
        }
        e = e?.next?.followedBy;
      } while (e);

      return sqlQuery;
    } catch (error) {
      throw new SQLQuerySpecificationException(error.message);
    }
  }

  private _handleFunctionInvokation(
    name: string,
    initialAlias: string,
    initialExpObjectName: string,
    query: SelectQueryBuilder<T>,
    leftHandSide: ExpressionLeftHandSide
  ): { isHandled: any; sqlInvokation: any } {
    if (!leftHandSide.content)
      throw new Error('LeftHandSide Content not defined');

    let func: string;
    const propName = name;
    const content = leftHandSide.content;
    if (
      content.type in PrimitiveTypes &&
      content.methodName in SQLStringFunctions
    ) {
      func = SQLStringFunctions[content.methodName];
      const sqlPart = format(func, propName, content.primitiveValue.toString());
      return { isHandled: true, sqlInvokation: sqlPart };
    } else if (
      !(content.type in PrimitiveTypes) &&
      content.methodName in SQLArrayFunctions
    ) {
      func = SQLArrayFunctions[content.methodName];
      const sqlPart = format(func, propName, content.primitiveValue.toString());
      return { isHandled: true, sqlInvokation: sqlPart };
    } else if (
      !(content.type in PrimitiveTypes) &&
      content.methodName in SQLJoinFunctions &&
      content.isExpression
    ) {
      let LHS = leftHandSide;
      let alias = initialAlias;
      const contextNamesAndalias = new Map<string, string>();
      contextNamesAndalias.set(initialExpObjectName, initialAlias);
      do {
        // trying to get the property name on which the function is called
        // i.e t => t.tickets.filter(...), we have to get 'tickets'
        // but since .propertyName attribute gives 'filter' we
        // have to go up the propertytree
        // LHS.propertyTree[LHS.propertyTree.length - 2]
        const { entityAlias } = this._getFieldNameAndAlias(
          alias,
          LHS.propertyTree[LHS.propertyTree.length - 2]
        );
        alias = entityAlias;
        const exp = LHS?.content?.expression;
        if (exp) {
          contextNamesAndalias.set(exp.expObjectName, alias);
          if (exp.rightHandSide) {
            this._chunkDownToQuery(
              exp,
              query,
              o => contextNamesAndalias.get(o),
              query.andWhere
            );
          }
        }
        LHS = exp?.leftHandSide;
      } while (LHS && LHS.isMethod && LHS.content && LHS.content.isExpression);

      return { isHandled: true, sqlInvokation: '' };
    }
    throw new Error('Unsupported Function Invokation: ' + content.methodName);
  }

  private _getUniqueParamName(
    paramName: string,
    sqlQuery: SelectQueryBuilder<T>
  ): string {
    paramName = paramName.replace(/\[|\]|\(|\)|\*|\+|\-|\'|\"/g, '');
    const keys = Object.keys(sqlQuery.getParameters());
    const similarKeys = keys.filter(k => k.startsWith(paramName));
    if (!similarKeys.length) return paramName;
    if (similarKeys.length === 1) return paramName + '_1';

    // removing first non-numbered param
    similarKeys.shift();

    let highOrderKey = similarKeys
      .map(k => Number.parseInt(k.replace(paramName + '_', ''), 0))
      .reduce((p, c) => (p > c ? p : c), 0);

    return paramName + '_' + ++highOrderKey;
  }

  public getQuery(): string {
    try {
      this._query = this.initialQuery(INITIAL_ALIAS).select();

      // tslint:disable-next-line: one-variable-per-declaration
      const includes = this.spec.getIncludes(),
        chainedIncludes = this.spec.getChainedIncludes(),
        criterias = this.spec.getCriterias(),
        orderBy = this.spec.getOrderBy(),
        orderByDescending = this.spec.getOrderByDescending(),
        selector = this.spec.getSelector(),
        take = this.spec.getTake(),
        skip = this.spec.getSkip(),
        thenBy = this.spec.getThenBy(),
        isPagingEnabled = this.spec.getIsPagingEnabled(),
        func = this.spec.getFunction();

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
        this._applyFunction(this._query, func);
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

        if (thenBy) {
          propertyAlias = this._getPropertyAlias(thenBy);
          this._query = this._query.addOrderBy(
            propertyAlias,
            isAsc ? 'ASC' : 'DESC'
          );
        }

        if (isPagingEnabled) {
          if (take) {
            this._query = this._query.take(take);
          }
          if (skip) {
            this._query = this._query.skip(skip);
          }
        }

        if (
          selector &&
          selector.fieldsToSelect &&
          selector.fieldsToSelect.length > 0
        ) {
          this._query.select(
            selector.fieldsToSelect.map(f => this._getPropertyAlias(f))
          );
        }
      }

      return this._query.getQuery();
    } catch (error) {
      throw new SQLQuerySpecificationException(error);
    }
  }
  private _applyFunction(
    query: SelectQueryBuilder<T>,
    value: {
      type: FunctionQueryType;
      func: SlimExpressionFunction<T>;
    }
  ) {
    const field = this._getPropertyAlias(value.func);
    query.select(`${value.type}(${field}) as ${value.type}`);
  }

  public async executeQuery<R = T[]>(type: QueryType): Promise<R> {
    this.getQuery();
    let toApply;
    switch (type) {
      case QueryType.ALL:
        toApply = this._query.getMany;
        break;
      case QueryType.ONE:
        toApply = this._query.getOne;
        break;
      case QueryType.RAW_ONE:
        toApply = this._query.getRawOne;
        break;
      case QueryType.RAW_ALL:
        toApply = this._query.getRawMany;
        break;

      default:
        break;
    }
    return (await toApply.call(this._query)) || [];
  }
}
