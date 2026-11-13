/* eslint-disable */
/* prettier-ignore */

export type introspection_types = {
    'Boolean': unknown;
    'ID': unknown;
    'Mutation': { kind: 'OBJECT'; name: 'Mutation'; fields: { 'addTodo': { name: 'addTodo'; type: { kind: 'NON_NULL'; name: never; ofType: { kind: 'OBJECT'; name: 'Todo'; ofType: null; }; } }; 'toggleTodo': { name: 'toggleTodo'; type: { kind: 'OBJECT'; name: 'Todo'; ofType: null; } }; }; };
    'Query': { kind: 'OBJECT'; name: 'Query'; fields: { 'todo': { name: 'todo'; type: { kind: 'OBJECT'; name: 'Todo'; ofType: null; } }; 'todos': { name: 'todos'; type: { kind: 'NON_NULL'; name: never; ofType: { kind: 'LIST'; name: never; ofType: { kind: 'NON_NULL'; name: never; ofType: { kind: 'OBJECT'; name: 'Todo'; ofType: null; }; }; }; } }; }; };
    'String': unknown;
    'Todo': { kind: 'OBJECT'; name: 'Todo'; fields: { 'done': { name: 'done'; type: { kind: 'NON_NULL'; name: never; ofType: { kind: 'SCALAR'; name: 'Boolean'; ofType: null; }; } }; 'id': { name: 'id'; type: { kind: 'NON_NULL'; name: never; ofType: { kind: 'SCALAR'; name: 'ID'; ofType: null; }; } }; 'title': { name: 'title'; type: { kind: 'NON_NULL'; name: never; ofType: { kind: 'SCALAR'; name: 'String'; ofType: null; }; } }; }; };
};

/** An IntrospectionQuery representation of your schema.
 *
 * @remarks
 * This is an introspection of your schema saved as a file by GraphQLSP.
 * It will automatically be used by `gql.tada` to infer the types of your GraphQL documents.
 * If you need to reuse this data or update your `scalars`, update `tadaOutputLocation` to
 * instead save to a .ts instead of a .d.ts file.
 */
export type introspection = {
  name: never;
  query: 'Query';
  mutation: 'Mutation';
  subscription: never;
  types: introspection_types;
};

import * as gqlTada from 'gql.tada';

declare module 'gql.tada' {
  interface setupSchema {
    introspection: introspection
  }
}