import { ConnectorConfig, DataConnect, OperationOptions, ExecuteOperationResponse } from 'firebase-admin/data-connect';

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
  users: ({
    id: UUIDString;
    name: string;
    email: string;
    phone?: string | null;
    role: string;
    isActive: boolean;
    createdAt: TimestampString;
    lastLogin?: TimestampString | null;
  } & User_Key)[];
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
  phone?: string | null;
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

/** Generated Node Admin SDK operation action function for the 'InsertUser' Mutation. Allow users to execute without passing in DataConnect. */
export function insertUser(dc: DataConnect, vars: InsertUserVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<InsertUserData>>;
/** Generated Node Admin SDK operation action function for the 'InsertUser' Mutation. Allow users to pass in custom DataConnect instances. */
export function insertUser(vars: InsertUserVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<InsertUserData>>;

/** Generated Node Admin SDK operation action function for the 'InsertSecurityLog' Mutation. Allow users to execute without passing in DataConnect. */
export function insertSecurityLog(dc: DataConnect, vars: InsertSecurityLogVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<InsertSecurityLogData>>;
/** Generated Node Admin SDK operation action function for the 'InsertSecurityLog' Mutation. Allow users to pass in custom DataConnect instances. */
export function insertSecurityLog(vars: InsertSecurityLogVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<InsertSecurityLogData>>;

/** Generated Node Admin SDK operation action function for the 'InsertDevice' Mutation. Allow users to execute without passing in DataConnect. */
export function insertDevice(dc: DataConnect, vars: InsertDeviceVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<InsertDeviceData>>;
/** Generated Node Admin SDK operation action function for the 'InsertDevice' Mutation. Allow users to pass in custom DataConnect instances. */
export function insertDevice(vars: InsertDeviceVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<InsertDeviceData>>;

/** Generated Node Admin SDK operation action function for the 'GetUserById' Query. Allow users to execute without passing in DataConnect. */
export function getUserById(dc: DataConnect, vars: GetUserByIdVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetUserByIdData>>;
/** Generated Node Admin SDK operation action function for the 'GetUserById' Query. Allow users to pass in custom DataConnect instances. */
export function getUserById(vars: GetUserByIdVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetUserByIdData>>;

/** Generated Node Admin SDK operation action function for the 'ListUsers' Query. Allow users to execute without passing in DataConnect. */
export function listUsers(dc: DataConnect, options?: OperationOptions): Promise<ExecuteOperationResponse<ListUsersData>>;
/** Generated Node Admin SDK operation action function for the 'ListUsers' Query. Allow users to pass in custom DataConnect instances. */
export function listUsers(options?: OperationOptions): Promise<ExecuteOperationResponse<ListUsersData>>;

/** Generated Node Admin SDK operation action function for the 'ListSecurityLogsForUser' Query. Allow users to execute without passing in DataConnect. */
export function listSecurityLogsForUser(dc: DataConnect, options?: OperationOptions): Promise<ExecuteOperationResponse<ListSecurityLogsForUserData>>;
/** Generated Node Admin SDK operation action function for the 'ListSecurityLogsForUser' Query. Allow users to pass in custom DataConnect instances. */
export function listSecurityLogsForUser(options?: OperationOptions): Promise<ExecuteOperationResponse<ListSecurityLogsForUserData>>;

