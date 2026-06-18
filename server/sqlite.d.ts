declare module "node:sqlite" {
  export type StatementResultingChanges = {
    changes: number;
    lastInsertRowid: number | bigint;
  };

  export class StatementSync {
    all(...params: unknown[]): unknown[];
    get(...params: unknown[]): unknown;
    run(...params: unknown[]): StatementResultingChanges;
  }

  export class DatabaseSync {
    constructor(path: string);
    exec(sql: string): void;
    prepare(sql: string): StatementSync;
  }
}
