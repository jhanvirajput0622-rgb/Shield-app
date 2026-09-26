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

  export interface Query {
    where(fieldPath: string, opStr: WhereFilterOp, value: unknown): Query;
    orderBy(fieldPath: string, directionStr?: "asc" | "desc"): Query;
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
