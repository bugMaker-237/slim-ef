import {
  ISpecification,
  CriteriaExpression,
  IQuerySpecificationEvaluator,
  QueryType,
  FunctionQueryType,
  FieldsSelector
} from './specification.interface';
import {
  SelectQueryBuilder,
  ObjectLiteral,
  Brackets,
  WhereExpressionBuilder
} from 'typeorm';
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
  PrimitiveValueTypes as PrimitiveTypes,
  ExpressionRightHandSide
} from 'slim-exp';
import { SQLQuerySpecificationException } from './exception';
const INITIAL_ALIAS = 'entity';
type WhereQuery<T> = (
  where: Brackets | string | ((qb: SelectQueryBuilder<T>) => string)
) => SelectQueryBuilder<T>;

type Sequence<T> = {
  toApply: WhereQuery<T>;
  queryStr: string;
  queryParams?: Record<string, any>;
};
type QuerySequence<T> = {
  firstSequence?: 'brackets' | 'topLevel';
  topLevelSequence: Sequence<T>[];
  bracketSequence?: QuerySequence<T>[];
  initialToApply: WhereQuery<T>;
};

export class SQLQuerySpecificationEvaluator<T extends object>
  implements IQuerySpecificationEvaluator<T> {
  private registerdAliases = [INITIAL_ALIAS];
  private _query: SelectQueryBuilder<T>;
  private _queryReady: boolean;
  private _discriminator: number = 0;
  private _selectBuilder: SlimExpressionFunction<T, any, any>;

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
    const {
      isAlreadyRegistered,
      propertyName,
      entityAlias
    } = this._getFieldNameAndAlias(intialAlias, name);
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
      const exp = new SlimExpression();
      exp.fromAction(selector.func, selector.context, false);
      exp.compile();
      const toApply = isFirst ? sqlQuery.where : sqlQuery.andWhere;
      // applying brackets around each where clause to improve consistency
      // and fiability of the request
      const brackets = new Brackets(wh => {
        this._chunkDownToQuery(exp, wh, alias, toApply);
      });
      toApply.call(sqlQuery, brackets);
      return sqlQuery;
    } catch (error) {
      throw new SQLQuerySpecificationException(
        error?.message +
        '; func:' +
        selector.func.toString() +
        '; context: ' +
        selector.context
          ? JSON.stringify(selector.context)
          : ''
      );
    }
  }

  private _chunkDownToQuery(
    exp: ISlimExpression<any, any, any>,
    sqlQuery: WhereExpressionBuilder,
    alias: ((implicitName: string) => string) | string,
    initialToApply: WhereQuery<T>,
    closingExp?: ISlimExpression<any, any, any>,
    setupBrackets: 'inactive' | 'active' = 'inactive'
  ): WhereExpressionBuilder {
    try {
      const querySequence = this._getQuerySequence(
        exp,
        alias,
        initialToApply,
        closingExp,
        setupBrackets
      );
      this._applyRecursively(sqlQuery, querySequence);

      return sqlQuery;
    } catch (error) {
      throw new SQLQuerySpecificationException(error.message);
    }
  }
  private _applyRecursively(
    sqlQuery: WhereExpressionBuilder,
    querySequence: QuerySequence<T>
  ) {
    const first = querySequence;

    const callBrackets = () => {
      for (const b of first.bracketSequence) {
        const brackets = new Brackets(wh => {
          this._applyRecursively(wh, b);
        });
        b.initialToApply.call(sqlQuery, brackets);
      }
    };

    const callTopLevel = () => {
      for (const s of first.topLevelSequence) {
        s.toApply.call(sqlQuery, s.queryStr, s.queryParams);
      }
    };

    if (first.firstSequence === 'brackets') {
      callBrackets();
      callTopLevel();
    } else {
      callTopLevel();
      callBrackets();
    }
  }

  private _getQuerySequence(
    exp: ISlimExpression<any, any, any>,
    alias: ((implicitName: string) => string) | string,
    initialToApply: WhereQuery<T>,
    closingExp?: ISlimExpression<any, any, any>,
    setupBrackets: 'inactive' | 'active' = 'inactive'
  ): QuerySequence<T> {
    let e = exp;
    let toApply = initialToApply;
    const querySequence: QuerySequence<T> = {
      topLevelSequence: [],
      bracketSequence: [],
      initialToApply
    };
    do {
      // When trying to understand this stuff, remember that logical operators are
      // associative, no matter the other be it exp1 && exp2 or exp2 && exp1 the
      // result is the same. So the real focus is to be able to handle the paranthesis
      // in a clean and oderable manner
      if (e.brackets?.openingExp) {
        querySequence.bracketSequence.push(
          this._getQuerySequence(
            e.brackets.openingExp,
            alias,
            toApply,
            e.brackets.closingExp,
            'active'
          )
        );
        if (!querySequence.firstSequence) {
          querySequence.firstSequence = 'brackets';
        }
      }

      if (e.computeHash() === closingExp?.computeHash()) {
        setupBrackets = 'inactive';
      }

      const sequence: QuerySequence<T> = this._buildQueryFromExpression(
        e.leftHandSide,
        e.rightHandSide,
        e.operator,
        e.expObjectName,
        alias,
        toApply,
        setupBrackets !== 'inactive'
      );

      if (!querySequence.firstSequence) {
        querySequence.firstSequence = 'topLevel';
      }
      querySequence.topLevelSequence.push(
        ...(sequence.topLevelSequence.filter(s => !!s.queryStr) || [])
      );
      querySequence.bracketSequence.push(...(sequence.bracketSequence || []));

      if (e.next) {
        toApply = this._isOrBinding(e.next.bindedBy)
          ? SelectQueryBuilder.prototype.orWhere
          : SelectQueryBuilder.prototype.andWhere;
      }
      e = e?.next?.followedBy;
    } while (e);

    return querySequence;
  }

  private _buildQueryFromExpression(
    lhs: ExpressionLeftHandSide,
    rhs: ExpressionRightHandSide,
    operator: string,
    expObjectName: string,
    alias: string | ((implicitName: string) => string),
    toApply?: WhereQuery<T>,
    isInBracketGroup: boolean = false
  ): QuerySequence<T> {
    let queryStr = '';
    let queryParams: ObjectLiteral;
    if (!lhs && !rhs) {
      return {
        topLevelSequence: [{ toApply, queryStr, queryParams }],
        initialToApply: toApply
      };
    }

    const lhsProp = lhs.isMethod
      ? lhs.propertyTree.slice(0, lhs.propertyTree.length - 1).join('.')
      : lhs.propertyName;
    const rhsProp = rhs?.propertyName;

    let lhsAlias: string;
    if (typeof alias !== 'string') {
      lhsAlias = alias(expObjectName);
    } else {
      lhsAlias = alias;
    }
    let rhsAlias: string;
    if (rhs) {
      if (typeof alias !== 'string') {
        rhsAlias = alias(rhs.implicitContextName);
      } else {
        rhsAlias = alias;
      }
    }
    const lhsName = this._getFieldFromRegisteredAlias(lhsAlias, lhsProp);
    const rhsName =
      rhsProp && rhsAlias
        ? this._getFieldFromRegisteredAlias(rhsAlias, rhsProp)
        : '';

    if (lhs.suffixOperator && !lhs.isMethod && !operator && !rhs) {
      const suffixOp = lhs.suffixOperator;
      queryStr += ` ${lhsName} ${convertToSqlComparisonOperator(
        ComparisonOperators.EQUAL_TO
      )} ${suffixOp === '!' ? SQLConstants.FALSE : SQLConstants.TRUE}`;
    }

    if (lhs.isMethod) {
      return this._handleFunctionInvokation(
        lhsName,
        lhsAlias,
        expObjectName,
        lhs,
        toApply,
        isInBracketGroup
      );
    }

    if (!lhs.suffixOperator && operator && rhs) {
      if (rhs.propertyType !== PrimitiveTypes.undefined) {
        const paramName = this._getUniqueParamName(rhs.propertyName);

        queryStr += ` ${
          lhs.isMethod ? '' : lhsName
        } ${convertToSqlComparisonOperator(
          operator,
          rhs.propertyValue
        )} :${paramName}`;
        queryParams = {} as any;

        // we need to format the date because typeorm has issue handling it with
        // sqlite
        queryParams[paramName] =
          rhs.propertyType === PrimitiveTypes.date
            ? this._polyfillDate(rhs.propertyValue)
            : rhs.propertyType === PrimitiveTypes.number
            ? rhs.propertyValue.toString()
            : rhs.propertyValue;
      } else {
        queryStr += ` ${
          lhs.isMethod ? '' : lhsName
        } ${convertToSqlComparisonOperator(
          operator,
          rhs.propertyValue
        )} ${rhsName}`;
      }
    }
    return {
      topLevelSequence: [{ toApply, queryStr, queryParams }],
      initialToApply: toApply
    };
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

  private _handleFunctionInvokation(
    name: string,
    initialAlias: string,
    initialExpObjectName: string,
    leftHandSide: ExpressionLeftHandSide,
    toApply?: WhereQuery<T>,
    isInBracketGroup: boolean = false
  ): QuerySequence<T> {
    if (!leftHandSide.content)
      throw new Error('LeftHandSide Content not defined');

    let func: string;
    let sqlPart: string;
    const propName = name;
    const content = leftHandSide.content;
    if (
      content.type in PrimitiveTypes &&
      content.methodName in SQLStringFunctions
    ) {
      func = SQLStringFunctions[content.methodName];
      sqlPart = format(func, propName, content.primitiveValue.toString());
      return {
        topLevelSequence: [{ toApply, queryStr: sqlPart }],
        initialToApply: toApply
      };
    } else if (
      !(content.type in PrimitiveTypes) &&
      content.methodName in SQLArrayFunctions &&
      Array.isArray(content.primitiveValue)
    ) {
      func = SQLArrayFunctions[content.methodName];
      const tb = content.primitiveValue.map(v => `'${v}'`);
      sqlPart = format(func, propName, tb.toString());
      return {
        topLevelSequence: [{ toApply, queryStr: sqlPart }],
        initialToApply: toApply
      };
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
        // i.e t => t.tickets.some(...), we have to get 'tickets'
        // but since .propertyName attribute gives 'some' we
        // have to go up the propertytree
        //  LHS.propertyTree.slice(0, LHS.propertyTree.length - 1).join('.')
        const { entityAlias } = this._getFieldNameAndAlias(
          alias,
          LHS.propertyTree.slice(0, LHS.propertyTree.length - 1).join('.'),
          true
        );
        alias = entityAlias;
        const exp = LHS?.content?.expression;
        if (exp) {
          contextNamesAndalias.set(exp.expObjectName, alias);
          if (exp.rightHandSide) {
            return this._getQuerySequence(
              exp,
              o => contextNamesAndalias.get(o),
              toApply,
              null,
              isInBracketGroup ? 'active' : 'inactive'
            );
          } else if (
            exp.leftHandSide &&
            exp.leftHandSide.isMethod &&
            !exp.leftHandSide.content.isExpression
          ) {
            const propTree = exp.leftHandSide.propertyName.split('.');
            propTree.pop();
            const field = this._getFieldFromRegisteredAlias(
              alias,
              propTree.join('.')
            );
            return this._handleFunctionInvokation(
              field,
              entityAlias,
              exp.expObjectName,
              exp.leftHandSide,
              toApply,
              false
            );
          }
        }
        LHS = exp?.leftHandSide;
      } while (LHS && LHS.isMethod && LHS.content && LHS.content.isExpression);

      return {
        topLevelSequence: [{ toApply, queryStr: sqlPart }],
        initialToApply: toApply
      };
    }
    throw new Error('Unsupported Function Invokation: ' + content.methodName);
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
            const toSelect = this._buildSelect(this._query, selector);
            this._query.select(toSelect);
            this._selectBuilder = selector.builder;
          }
        }
        this._queryReady = true;
        return res(this._query.getQuery());
      } catch (error) {
        throw new SQLQuerySpecificationException(error);
      }
    });
  }
  private _buildSelect(
    _query: SelectQueryBuilder<T>,
    selector: FieldsSelector<T>
  ): string[] {
    const toSelect = [
      ...selector.fieldsToSelect.map(f => this._getPropertyAlias(f.field))
    ];

    // If id is not present typeorm throws an exception.
    // So we go get the id field

    for (const c of this._query.expressionMap.mainAlias.metadata.columns) {
      if (c.isPrimary) {
        toSelect.push(
          this._getFieldFromRegisteredAlias(INITIAL_ALIAS, c.propertyName)
        );
        break;
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
      for (const f of j.relation.foreignKeys) {
        for (const c of f.columnNames) {
          toSelect.push(this._getFieldFromRegisteredAlias(finalName, c));
        }
      }
    }
    return toSelect;
  }
  private _applyFunction(
    query: SelectQueryBuilder<T>,
    value: {
      type: FunctionQueryType;
      func: SlimExpressionFunction<T>;
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
        toApply = this._query.getRawMany;
        defaultVal = [];
        break;

      default:
        break;
    }
    const result = (await toApply.call(this._query)) || defaultVal;
    let finalRes: any;
    if (this._selectBuilder) {
      finalRes = Array.isArray(result)
        ? result.map(r => this._selectBuilder(r))
        : this._selectBuilder(result);
    } else {
      finalRes = result;
    }
    return finalRes;
  }
}
