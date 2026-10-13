import { ConnectorConfig, DataConnect, QueryRef, QueryPromise, ExecuteQueryOptions, MutationRef, MutationPromise } from 'firebase/data-connect';

export const connectorConfig: ConnectorConfig;

export type TimestampString = string;
export type UUIDString = string;
export type Int64String = string;
export type DateString = string;




export interface Admin_Key {
  id: UUIDString;
  __typename?: 'Admin_Key';
}

export interface AntiTheft_Key {
  id: UUIDString;
  __typename?: 'AntiTheft_Key';
}

export interface AppPermission_Key {
  id: UUIDString;
  __typename?: 'AppPermission_Key';
}

export interface AppSession_Key {
  id: UUIDString;
  __typename?: 'AppSession_Key';
}

export interface AuditEvent_Key {
  id: UUIDString;
  __typename?: 'AuditEvent_Key';
}

export interface Device_Key {
  id: UUIDString;
  __typename?: 'Device_Key';
}

export interface GetUserByIdData {
  user?: {
    id: UUIDString;
    name: string;
    email: string;
    phone?: string | null;
    role: string;
    isActive: boolean;
    createdAt: TimestampString;
    lastLogin?: TimestampString | null;
  } & User_Key;
}

export interface GetUserByIdVariables {
  id: UUIDString;
}

export interface InsertDeviceData {
  device_insert: Device_Key;
}

export interface InsertDeviceVariables {
  userId: UUIDString;
  deviceName: string;
  osType: string;
  deviceModel: string;
  deviceIdHash: string;
}

export interface InsertSecurityLogData {
  securityLog_insert: SecurityLog_Key;
}

export interface InsertSecurityLogVariables {
  userId: UUIDString;
  eventType: string;
  description?: string | null;
  severity: string;
  status: string;
}

export interface InsertUserData {
  user_insert: User_Key;
}

export interface InsertUserVariables {
  name: string;
  email: string;
  passwordHash: string;
  phone?: string | null;
  role: string;
}

export interface ListSecurityLogsForUserData {
  securityLogs: ({
    id: UUIDString;
    eventType: string;
    description?: string | null;
    severity: string;
    status: string;
    timestamp: TimestampString;
  } & SecurityLog_Key)[];
}

export interface ListSecurityLogsForUserVariables {
  userId: UUIDString;
}

export interface ListUsersData {
  users: ({
    id: UUIDString;
    name: string;
    email: string;
    role: string;
    isActive: boolean;
    createdAt: TimestampString;
  } & User_Key)[];
}

export interface PhishingDetection_Key {
  id: UUIDString;
  __typename?: 'PhishingDetection_Key';
}

export interface ProtectionSettings_Key {
  id: UUIDString;
  __typename?: 'ProtectionSettings_Key';
}

export interface SecurityLog_Key {
  id: UUIDString;
  __typename?: 'SecurityLog_Key';
}

export interface User_Key {
  id: UUIDString;
  __typename?: 'User_Key';
}

export interface VpnConnection_Key {
  id: UUIDString;
  __typename?: 'VpnConnection_Key';
}

interface InsertUserRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: InsertUserVariables): MutationRef<InsertUserData, InsertUserVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: InsertUserVariables): MutationRef<InsertUserData, InsertUserVariables>;
  operationName: string;
}
export const insertUserRef: InsertUserRef;

export function insertUser(vars: InsertUserVariables): MutationPromise<InsertUserData, InsertUserVariables>;
export function insertUser(dc: DataConnect, vars: InsertUserVariables): MutationPromise<InsertUserData, InsertUserVariables>;

interface InsertSecurityLogRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: InsertSecurityLogVariables): MutationRef<InsertSecurityLogData, InsertSecurityLogVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: InsertSecurityLogVariables): MutationRef<InsertSecurityLogData, InsertSecurityLogVariables>;
  operationName: string;
}
export const insertSecurityLogRef: InsertSecurityLogRef;

export function insertSecurityLog(vars: InsertSecurityLogVariables): MutationPromise<InsertSecurityLogData, InsertSecurityLogVariables>;
export function insertSecurityLog(dc: DataConnect, vars: InsertSecurityLogVariables): MutationPromise<InsertSecurityLogData, InsertSecurityLogVariables>;

interface InsertDeviceRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: InsertDeviceVariables): MutationRef<InsertDeviceData, InsertDeviceVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: InsertDeviceVariables): MutationRef<InsertDeviceData, InsertDeviceVariables>;
  operationName: string;
}
export const insertDeviceRef: InsertDeviceRef;

export function insertDevice(vars: InsertDeviceVariables): MutationPromise<InsertDeviceData, InsertDeviceVariables>;
export function insertDevice(dc: DataConnect, vars: InsertDeviceVariables): MutationPromise<InsertDeviceData, InsertDeviceVariables>;

interface GetUserByIdRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetUserByIdVariables): QueryRef<GetUserByIdData, GetUserByIdVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: GetUserByIdVariables): QueryRef<GetUserByIdData, GetUserByIdVariables>;
  operationName: string;
}
export const getUserByIdRef: GetUserByIdRef;

export function getUserById(vars: GetUserByIdVariables, options?: ExecuteQueryOptions): QueryPromise<GetUserByIdData, GetUserByIdVariables>;
export function getUserById(dc: DataConnect, vars: GetUserByIdVariables, options?: ExecuteQueryOptions): QueryPromise<GetUserByIdData, GetUserByIdVariables>;

interface ListUsersRef {
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<ListUsersData, undefined>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect): QueryRef<ListUsersData, undefined>;
  operationName: string;
}
export const listUsersRef: ListUsersRef;

export function listUsers(options?: ExecuteQueryOptions): QueryPromise<ListUsersData, undefined>;
export function listUsers(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<ListUsersData, undefined>;

interface ListSecurityLogsForUserRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: ListSecurityLogsForUserVariables): QueryRef<ListSecurityLogsForUserData, ListSecurityLogsForUserVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: ListSecurityLogsForUserVariables): QueryRef<ListSecurityLogsForUserData, ListSecurityLogsForUserVariables>;
  operationName: string;
}
export const listSecurityLogsForUserRef: ListSecurityLogsForUserRef;

export function listSecurityLogsForUser(vars: ListSecurityLogsForUserVariables, options?: ExecuteQueryOptions): QueryPromise<ListSecurityLogsForUserData, ListSecurityLogsForUserVariables>;
export function listSecurityLogsForUser(dc: DataConnect, vars: ListSecurityLogsForUserVariables, options?: ExecuteQueryOptions): QueryPromise<ListSecurityLogsForUserData, ListSecurityLogsForUserVariables>;

