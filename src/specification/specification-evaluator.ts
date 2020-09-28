import {
  ISpecification,
  CriteriaExpression,
  IQuerySpecificationEvaluator,
  QueryType,
  FunctionQueryType
} from './specification.interface';
import { SelectQueryBuilder, ObjectLiteral, Brackets, WhereExpression, QueryBuilder } from 'typeorm';
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
import { Query } from 'typeorm/driver/Query';

const INITIAL_ALIAS = 'entity';
type WhereQuery<T> = (
  where: Brackets | string | ((qb: SelectQueryBuilder<T>) => string)
) => SelectQueryBuilder<T>;

type Sequence<T> = { toApply: WhereQuery<T>, queryStr: string, queryParams?: Record<string, any> };
type QuerySequence<T> = {
  topLevelSequence: Sequence<T>[],
  bracketSequence?: QuerySequence<T>[],
  initialToApply: WhereQuery<T>
}

export class SQLQuerySpecificationEvaluator<T>
  implements IQuerySpecificationEvaluator<T> {
  private registerdAliases = [INITIAL_ALIAS];
  private _query: SelectQueryBuilder<T>;
  private _queryReady: boolean;
  private _discriminator: number = 0;

  constructor(
    private readonly initialQuery: (alias: string) => SelectQueryBuilder<T>,
    private readonly spec: ISpecification<T>
  ) {
    this._queryReady = false;
  }

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
    initialToApply: WhereQuery<T>,
    closingExp?: ISlimExpression<any, any, any>,
    setupBrackets: 'inactive' | 'active' = 'inactive'
  ): SelectQueryBuilder<T> {
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
  private _applyRecursively(sqlQuery: WhereExpression, querySequence: QuerySequence<T>) {
    const first = querySequence;

    for (const s of first.topLevelSequence) {
      s.toApply.call(sqlQuery, s.queryStr, s.queryParams);
    }
    for (const b of first.bracketSequence) {
      const brackets = new Brackets(wh => {
        this._applyRecursively(wh, b);
      });
      b.initialToApply.call(sqlQuery, brackets);
    }
  }

  private _getQuerySequence(
    exp: ISlimExpression<any, any, any>,
    alias: ((implicitName: string) => string) | string,
    initialToApply: WhereQuery<T>,
    closingExp?: ISlimExpression<any, any, any>,
    setupBrackets: 'inactive' | 'active' = 'inactive')
    : QuerySequence<T> {
    let e = exp;
    let toApply = initialToApply;
    const querySequence: QuerySequence<T> = { topLevelSequence: [], bracketSequence: [], initialToApply };
    do {
      // When trying to understand this stuff, remember that logical operators are
      // associative, no matter the other be it exp1 && exp2 or exp2 && exp1 the
      // result is the same. So the real focus is to be able to handle the paranthesis
      // in a clean and oderable manner
      if (e.brackets?.openingExp) {
        querySequence.bracketSequence.push(this._getQuerySequence(
          e.brackets.openingExp,
          alias,
          toApply,
          e.brackets.closingExp,
          'active'
        ));
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
      querySequence.topLevelSequence.push(...(sequence.topLevelSequence.filter(s => !!s.queryStr) || []));
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
      return { topLevelSequence: [{ toApply, queryStr, queryParams }], initialToApply: toApply };
    }

    const lhsProp = lhs.isMethod
      ? lhs.propertyTree
        .slice(0, lhs.propertyTree.length - 1)
        .join('.')
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

    if (
      lhs.suffixOperator &&
      !lhs.isMethod &&
      !operator &&
      !rhs
    ) {
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
        const paramName = this._getUniqueParamName(
          rhs.propertyName
        );

        queryStr += ` ${
          lhs.isMethod ? '' : lhsName
          } ${convertToSqlComparisonOperator(operator)} :${paramName}`;
        queryParams = {} as any;
        queryParams[paramName] = rhs.propertyValue;
      } else {
        queryStr += ` ${
          lhs.isMethod ? '' : lhsName
          } ${convertToSqlComparisonOperator(operator)} ${rhsName}`;
      }
    }
    return { topLevelSequence: [{ toApply, queryStr, queryParams }], initialToApply: toApply };
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
      return { topLevelSequence: [{ toApply, queryStr: sqlPart }], initialToApply: toApply };
    } else if (
      !(content.type in PrimitiveTypes) &&
      content.methodName in SQLArrayFunctions
    ) {
      func = SQLArrayFunctions[content.methodName];
      sqlPart = format(func, propName, content.primitiveValue.toString());
      return { topLevelSequence: [{ toApply, queryStr: sqlPart }], initialToApply: toApply };
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
            return this._getQuerySequence(
              exp,
              o => contextNamesAndalias.get(o),
              toApply,
              null,
              isInBracketGroup ? 'active' : 'inactive'
            );
          }
        }
        LHS = exp?.leftHandSide;
      } while (LHS && LHS.isMethod && LHS.content && LHS.content.isExpression);

      return { topLevelSequence: [{ toApply, queryStr: sqlPart }], initialToApply: toApply };
    }
    throw new Error('Unsupported Function Invokation: ' + content.methodName);
  }

  private _getUniqueParamName(
    paramName: string
  ): string {
    paramName = paramName.replace(/\[|\]|\(|\)|\*|\+|\-|\'|\"/g, '');

    return paramName + '_' + ++this._discriminator;
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
      this._queryReady = true;
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
  ): SelectQueryBuilder<T> {

    const field = value.func ? this._getPropertyAlias(value.func) : "*";
    return query.select(`${value.type}(${field}) as \`${value.type}\``);
  }

  public async executeQuery<R = T[]>(type: QueryType): Promise<R> {
    if (!this._queryReady)
      this.getQuery();
    let toApply;
    let defaultVal;
    switch (type) {
      case QueryType.ALL:
        toApply = this._query.getMany;
        defaultVal = [];
        break;
      case QueryType.ONE:
        toApply = this._query.getOne;
        defaultVal = {};
        break;
      case QueryType.RAW_ONE:
        toApply = this._query.getRawOne;
        defaultVal = {};
        break;
      case QueryType.RAW_ALL:
        toApply = this._query.getRawMany;
        defaultVal = [];
        break;

      default:
        break;
    }
    const result = (await toApply.call(this._query)) || defaultVal;
    return result;
  }
}
