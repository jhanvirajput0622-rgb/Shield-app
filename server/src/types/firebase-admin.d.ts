declare module "firebase-admin/app" {
  export function initializeApp(options?: Record<string, unknown>): unknown;
  export function getApps(): Array<unknown>;
}

declare module "firebase-admin/firestore" {
  export type WhereFilterOp =
    | "<"
    | "<="
    | "=="
    | ">="
    | ">"
    | "array-contains"
    | "in"
    | "array-contains-any"
    | "not-in";

  export interface Firestore {
    collection(path: string): CollectionReference;
    doc(path: string): DocumentReference;
  }

  export interface CollectionReference {
    doc(id?: string): DocumentReference;
    where(fieldPath: string, opStr: WhereFilterOp, value: unknown): Query;
    orderBy(fieldPath: string, directionStr?: "asc" | "desc"): Query;
    limit(limit: number): Query;
    get(): Promise<{ docs: Array<{ id: string; data(): unknown }> }>;
  }

  export interface FieldPath {
    toString(): string;
  }

  export interface Query {
    where(fieldPath: string, opStr: WhereFilterOp, value: unknown): Query;
    orderBy(fieldPath: string | FieldPath, directionStr?: "asc" | "desc"): Query;
    limit(limit: number): Query;
    get(): Promise<{ docs: Array<{ id: string; data(): unknown }> }>;
  }

  export interface DocumentReference {
    get(): Promise<{ exists: boolean; data(): unknown; id: string }>;
    set(data: unknown, options?: { merge?: boolean }): Promise<void>;
    update(data: Record<string, unknown>): Promise<void>;
    delete(): Promise<void>;
    collection(path: string): CollectionReference;
  }

  export function getFirestore(): Firestore;
  /**
   * `FieldPath.documentId()` yields `__name__`, the implicit final tiebreaker
   * Firestore applies to any ordered query. Ordering by it explicitly makes the
   * ordering total, which is what makes a field-value pagination cursor
   * unambiguous when several documents share a sort value. See db/queries.ts.
   */
  export const FieldPath: {
    documentId(): FieldPath;
  };
  export const FieldValue: {
    serverTimestamp: () => unknown;
    delete: () => unknown;
    increment: (n: number) => unknown;
    arrayUnion: (...elements: unknown[]) => unknown;
  };
  export const Timestamp: {
    now: () => { toDate: () => Date };
    fromDate: (date: Date) => unknown;
  };
}
