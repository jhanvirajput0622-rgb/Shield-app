import { InsertUserData, InsertUserVariables, InsertSecurityLogData, InsertSecurityLogVariables, InsertDeviceData, InsertDeviceVariables, GetUserByIdData, GetUserByIdVariables, ListUsersData, ListSecurityLogsForUserData } from '../';
import { UseDataConnectQueryResult, useDataConnectQueryOptions, UseDataConnectMutationResult, useDataConnectMutationOptions} from '@tanstack-query-firebase/react/data-connect';
import { UseQueryResult, UseMutationResult} from '@tanstack/react-query';
import { DataConnect } from 'firebase/data-connect';
import { FirebaseError } from 'firebase/app';


export function useInsertUser(options?: useDataConnectMutationOptions<InsertUserData, FirebaseError, InsertUserVariables>): UseDataConnectMutationResult<InsertUserData, InsertUserVariables>;
export function useInsertUser(dc: DataConnect, options?: useDataConnectMutationOptions<InsertUserData, FirebaseError, InsertUserVariables>): UseDataConnectMutationResult<InsertUserData, InsertUserVariables>;

export function useInsertSecurityLog(options?: useDataConnectMutationOptions<InsertSecurityLogData, FirebaseError, InsertSecurityLogVariables>): UseDataConnectMutationResult<InsertSecurityLogData, InsertSecurityLogVariables>;
export function useInsertSecurityLog(dc: DataConnect, options?: useDataConnectMutationOptions<InsertSecurityLogData, FirebaseError, InsertSecurityLogVariables>): UseDataConnectMutationResult<InsertSecurityLogData, InsertSecurityLogVariables>;

export function useInsertDevice(options?: useDataConnectMutationOptions<InsertDeviceData, FirebaseError, InsertDeviceVariables>): UseDataConnectMutationResult<InsertDeviceData, InsertDeviceVariables>;
export function useInsertDevice(dc: DataConnect, options?: useDataConnectMutationOptions<InsertDeviceData, FirebaseError, InsertDeviceVariables>): UseDataConnectMutationResult<InsertDeviceData, InsertDeviceVariables>;

export function useGetUserById(vars: GetUserByIdVariables, options?: useDataConnectQueryOptions<GetUserByIdData>): UseDataConnectQueryResult<GetUserByIdData, GetUserByIdVariables>;
export function useGetUserById(dc: DataConnect, vars: GetUserByIdVariables, options?: useDataConnectQueryOptions<GetUserByIdData>): UseDataConnectQueryResult<GetUserByIdData, GetUserByIdVariables>;

export function useListUsers(options?: useDataConnectQueryOptions<ListUsersData>): UseDataConnectQueryResult<ListUsersData, undefined>;
export function useListUsers(dc: DataConnect, options?: useDataConnectQueryOptions<ListUsersData>): UseDataConnectQueryResult<ListUsersData, undefined>;

export function useListSecurityLogsForUser(options?: useDataConnectQueryOptions<ListSecurityLogsForUserData>): UseDataConnectQueryResult<ListSecurityLogsForUserData, undefined>;
export function useListSecurityLogsForUser(dc: DataConnect, options?: useDataConnectQueryOptions<ListSecurityLogsForUserData>): UseDataConnectQueryResult<ListSecurityLogsForUserData, undefined>;
