# Generated TypeScript README
This README will guide you through the process of using the generated JavaScript SDK package for the connector `example`. It will also provide examples on how to use your generated SDK to call your Data Connect queries and mutations.

***NOTE:** This README is generated alongside the generated SDK. If you make changes to this file, they will be overwritten when the SDK is regenerated.*

# Table of Contents
- [**Overview**](#generated-javascript-readme)
- [**Accessing the connector**](#accessing-the-connector)
  - [*Connecting to the local Emulator*](#connecting-to-the-local-emulator)
- [**Queries**](#queries)
  - [*GetUserById*](#getuserbyid)
  - [*ListUsers*](#listusers)
  - [*ListSecurityLogsForUser*](#listsecuritylogsforuser)
- [**Mutations**](#mutations)
  - [*InsertUser*](#insertuser)
  - [*InsertSecurityLog*](#insertsecuritylog)
  - [*InsertDevice*](#insertdevice)

# Accessing the connector
A connector is a collection of Queries and Mutations. One SDK is generated for each connector - this SDK is generated for the connector `example`. You can find more information about connectors in the [Data Connect documentation](https://firebase.google.com/docs/data-connect#how-does).

You can use this generated SDK by importing from the package `@dataconnect/generated` as shown below. Both CommonJS and ESM imports are supported.

You can also follow the instructions from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#set-client).

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig } from '@dataconnect/generated';

const dataConnect = getDataConnect(connectorConfig);
```

## Connecting to the local Emulator
By default, the connector will connect to the production service.

To connect to the emulator, you can use the following code.
You can also follow the emulator instructions from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#instrument-clients).

```typescript
import { connectDataConnectEmulator, getDataConnect } from 'firebase/data-connect';
import { connectorConfig } from '@dataconnect/generated';

const dataConnect = getDataConnect(connectorConfig);
connectDataConnectEmulator(dataConnect, 'localhost', 9399);
```

After it's initialized, you can call your Data Connect [queries](#queries) and [mutations](#mutations) from your generated SDK.

# Queries

There are two ways to execute a Data Connect Query using the generated Web SDK:
- Using a Query Reference function, which returns a `QueryRef`
  - The `QueryRef` can be used as an argument to `executeQuery()`, which will execute the Query and return a `QueryPromise`
- Using an action shortcut function, which returns a `QueryPromise`
  - Calling the action shortcut function will execute the Query and return a `QueryPromise`

The following is true for both the action shortcut function and the `QueryRef` function:
- The `QueryPromise` returned will resolve to the result of the Query once it has finished executing
- If the Query accepts arguments, both the action shortcut function and the `QueryRef` function accept a single argument: an object that contains all the required variables (and the optional variables) for the Query
- Both functions can be called with or without passing in a `DataConnect` instance as an argument. If no `DataConnect` argument is passed in, then the generated SDK will call `getDataConnect(connectorConfig)` behind the scenes for you.

Below are examples of how to use the `example` connector's generated functions to execute each query. You can also follow the examples from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#using-queries).

## GetUserById
You can execute the `GetUserById` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
getUserById(vars: GetUserByIdVariables, options?: ExecuteQueryOptions): QueryPromise<GetUserByIdData, GetUserByIdVariables>;

interface GetUserByIdRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetUserByIdVariables): QueryRef<GetUserByIdData, GetUserByIdVariables>;
}
export const getUserByIdRef: GetUserByIdRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
getUserById(dc: DataConnect, vars: GetUserByIdVariables, options?: ExecuteQueryOptions): QueryPromise<GetUserByIdData, GetUserByIdVariables>;

interface GetUserByIdRef {
  ...
  (dc: DataConnect, vars: GetUserByIdVariables): QueryRef<GetUserByIdData, GetUserByIdVariables>;
}
export const getUserByIdRef: GetUserByIdRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the getUserByIdRef:
```typescript
const name = getUserByIdRef.operationName;
console.log(name);
```

### Variables
The `GetUserById` query requires an argument of type `GetUserByIdVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface GetUserByIdVariables {
  id: UUIDString;
}
```
### Return Type
Recall that executing the `GetUserById` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `GetUserByIdData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
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
```
### Using `GetUserById`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, getUserById, GetUserByIdVariables } from '@dataconnect/generated';

// The `GetUserById` query requires an argument of type `GetUserByIdVariables`:
const getUserByIdVars: GetUserByIdVariables = {
  id: ..., 
};

// Call the `getUserById()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await getUserById(getUserByIdVars);
// Variables can be defined inline as well.
const { data } = await getUserById({ id: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await getUserById(dataConnect, getUserByIdVars);

console.log(data.users);

// Or, you can use the `Promise` API.
getUserById(getUserByIdVars).then((response) => {
  const data = response.data;
  console.log(data.users);
});
```

### Using `GetUserById`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, getUserByIdRef, GetUserByIdVariables } from '@dataconnect/generated';

// The `GetUserById` query requires an argument of type `GetUserByIdVariables`:
const getUserByIdVars: GetUserByIdVariables = {
  id: ..., 
};

// Call the `getUserByIdRef()` function to get a reference to the query.
const ref = getUserByIdRef(getUserByIdVars);
// Variables can be defined inline as well.
const ref = getUserByIdRef({ id: ..., });

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = getUserByIdRef(dataConnect, getUserByIdVars);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.users);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.users);
});
```

## ListUsers
You can execute the `ListUsers` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
listUsers(options?: ExecuteQueryOptions): QueryPromise<ListUsersData, undefined>;

interface ListUsersRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<ListUsersData, undefined>;
}
export const listUsersRef: ListUsersRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
listUsers(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<ListUsersData, undefined>;

interface ListUsersRef {
  ...
  (dc: DataConnect): QueryRef<ListUsersData, undefined>;
}
export const listUsersRef: ListUsersRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the listUsersRef:
```typescript
const name = listUsersRef.operationName;
console.log(name);
```

### Variables
The `ListUsers` query has no variables.
### Return Type
Recall that executing the `ListUsers` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `ListUsersData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
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
```
### Using `ListUsers`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, listUsers } from '@dataconnect/generated';


// Call the `listUsers()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await listUsers();

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await listUsers(dataConnect);

console.log(data.users);

// Or, you can use the `Promise` API.
listUsers().then((response) => {
  const data = response.data;
  console.log(data.users);
});
```

### Using `ListUsers`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, listUsersRef } from '@dataconnect/generated';


// Call the `listUsersRef()` function to get a reference to the query.
const ref = listUsersRef();

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = listUsersRef(dataConnect);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.users);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.users);
});
```

## ListSecurityLogsForUser
You can execute the `ListSecurityLogsForUser` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
listSecurityLogsForUser(options?: ExecuteQueryOptions): QueryPromise<ListSecurityLogsForUserData, undefined>;

interface ListSecurityLogsForUserRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<ListSecurityLogsForUserData, undefined>;
}
export const listSecurityLogsForUserRef: ListSecurityLogsForUserRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
listSecurityLogsForUser(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<ListSecurityLogsForUserData, undefined>;

interface ListSecurityLogsForUserRef {
  ...
  (dc: DataConnect): QueryRef<ListSecurityLogsForUserData, undefined>;
}
export const listSecurityLogsForUserRef: ListSecurityLogsForUserRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the listSecurityLogsForUserRef:
```typescript
const name = listSecurityLogsForUserRef.operationName;
console.log(name);
```

### Variables
The `ListSecurityLogsForUser` query has no variables.
### Return Type
Recall that executing the `ListSecurityLogsForUser` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `ListSecurityLogsForUserData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
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
```
### Using `ListSecurityLogsForUser`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, listSecurityLogsForUser } from '@dataconnect/generated';


// Call the `listSecurityLogsForUser()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await listSecurityLogsForUser();

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await listSecurityLogsForUser(dataConnect);

console.log(data.securityLogs);

// Or, you can use the `Promise` API.
listSecurityLogsForUser().then((response) => {
  const data = response.data;
  console.log(data.securityLogs);
});
```

### Using `ListSecurityLogsForUser`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, listSecurityLogsForUserRef } from '@dataconnect/generated';


// Call the `listSecurityLogsForUserRef()` function to get a reference to the query.
const ref = listSecurityLogsForUserRef();

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = listSecurityLogsForUserRef(dataConnect);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.securityLogs);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.securityLogs);
});
```

# Mutations

There are two ways to execute a Data Connect Mutation using the generated Web SDK:
- Using a Mutation Reference function, which returns a `MutationRef`
  - The `MutationRef` can be used as an argument to `executeMutation()`, which will execute the Mutation and return a `MutationPromise`
- Using an action shortcut function, which returns a `MutationPromise`
  - Calling the action shortcut function will execute the Mutation and return a `MutationPromise`

The following is true for both the action shortcut function and the `MutationRef` function:
- The `MutationPromise` returned will resolve to the result of the Mutation once it has finished executing
- If the Mutation accepts arguments, both the action shortcut function and the `MutationRef` function accept a single argument: an object that contains all the required variables (and the optional variables) for the Mutation
- Both functions can be called with or without passing in a `DataConnect` instance as an argument. If no `DataConnect` argument is passed in, then the generated SDK will call `getDataConnect(connectorConfig)` behind the scenes for you.

Below are examples of how to use the `example` connector's generated functions to execute each mutation. You can also follow the examples from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#using-mutations).

## InsertUser
You can execute the `InsertUser` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
insertUser(vars: InsertUserVariables): MutationPromise<InsertUserData, InsertUserVariables>;

interface InsertUserRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: InsertUserVariables): MutationRef<InsertUserData, InsertUserVariables>;
}
export const insertUserRef: InsertUserRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
insertUser(dc: DataConnect, vars: InsertUserVariables): MutationPromise<InsertUserData, InsertUserVariables>;

interface InsertUserRef {
  ...
  (dc: DataConnect, vars: InsertUserVariables): MutationRef<InsertUserData, InsertUserVariables>;
}
export const insertUserRef: InsertUserRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the insertUserRef:
```typescript
const name = insertUserRef.operationName;
console.log(name);
```

### Variables
The `InsertUser` mutation requires an argument of type `InsertUserVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface InsertUserVariables {
  name: string;
  phone?: string | null;
}
```
### Return Type
Recall that executing the `InsertUser` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `InsertUserData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface InsertUserData {
  user_insert: User_Key;
}
```
### Using `InsertUser`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, insertUser, InsertUserVariables } from '@dataconnect/generated';

// The `InsertUser` mutation requires an argument of type `InsertUserVariables`:
const insertUserVars: InsertUserVariables = {
  name: ..., 
  phone: ..., // optional
};

// Call the `insertUser()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await insertUser(insertUserVars);
// Variables can be defined inline as well.
const { data } = await insertUser({ name: ..., phone: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await insertUser(dataConnect, insertUserVars);

console.log(data.user_insert);

// Or, you can use the `Promise` API.
insertUser(insertUserVars).then((response) => {
  const data = response.data;
  console.log(data.user_insert);
});
```

### Using `InsertUser`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, insertUserRef, InsertUserVariables } from '@dataconnect/generated';

// The `InsertUser` mutation requires an argument of type `InsertUserVariables`:
const insertUserVars: InsertUserVariables = {
  name: ..., 
  phone: ..., // optional
};

// Call the `insertUserRef()` function to get a reference to the mutation.
const ref = insertUserRef(insertUserVars);
// Variables can be defined inline as well.
const ref = insertUserRef({ name: ..., phone: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = insertUserRef(dataConnect, insertUserVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.user_insert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.user_insert);
});
```

## InsertSecurityLog
You can execute the `InsertSecurityLog` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
insertSecurityLog(vars: InsertSecurityLogVariables): MutationPromise<InsertSecurityLogData, InsertSecurityLogVariables>;

interface InsertSecurityLogRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: InsertSecurityLogVariables): MutationRef<InsertSecurityLogData, InsertSecurityLogVariables>;
}
export const insertSecurityLogRef: InsertSecurityLogRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
insertSecurityLog(dc: DataConnect, vars: InsertSecurityLogVariables): MutationPromise<InsertSecurityLogData, InsertSecurityLogVariables>;

interface InsertSecurityLogRef {
  ...
  (dc: DataConnect, vars: InsertSecurityLogVariables): MutationRef<InsertSecurityLogData, InsertSecurityLogVariables>;
}
export const insertSecurityLogRef: InsertSecurityLogRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the insertSecurityLogRef:
```typescript
const name = insertSecurityLogRef.operationName;
console.log(name);
```

### Variables
The `InsertSecurityLog` mutation requires an argument of type `InsertSecurityLogVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface InsertSecurityLogVariables {
  userId: UUIDString;
  eventType: string;
  description?: string | null;
  severity: string;
  status: string;
}
```
### Return Type
Recall that executing the `InsertSecurityLog` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `InsertSecurityLogData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface InsertSecurityLogData {
  securityLog_insert: SecurityLog_Key;
}
```
### Using `InsertSecurityLog`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, insertSecurityLog, InsertSecurityLogVariables } from '@dataconnect/generated';

// The `InsertSecurityLog` mutation requires an argument of type `InsertSecurityLogVariables`:
const insertSecurityLogVars: InsertSecurityLogVariables = {
  userId: ..., 
  eventType: ..., 
  description: ..., // optional
  severity: ..., 
  status: ..., 
};

// Call the `insertSecurityLog()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await insertSecurityLog(insertSecurityLogVars);
// Variables can be defined inline as well.
const { data } = await insertSecurityLog({ userId: ..., eventType: ..., description: ..., severity: ..., status: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await insertSecurityLog(dataConnect, insertSecurityLogVars);

console.log(data.securityLog_insert);

// Or, you can use the `Promise` API.
insertSecurityLog(insertSecurityLogVars).then((response) => {
  const data = response.data;
  console.log(data.securityLog_insert);
});
```

### Using `InsertSecurityLog`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, insertSecurityLogRef, InsertSecurityLogVariables } from '@dataconnect/generated';

// The `InsertSecurityLog` mutation requires an argument of type `InsertSecurityLogVariables`:
const insertSecurityLogVars: InsertSecurityLogVariables = {
  userId: ..., 
  eventType: ..., 
  description: ..., // optional
  severity: ..., 
  status: ..., 
};

// Call the `insertSecurityLogRef()` function to get a reference to the mutation.
const ref = insertSecurityLogRef(insertSecurityLogVars);
// Variables can be defined inline as well.
const ref = insertSecurityLogRef({ userId: ..., eventType: ..., description: ..., severity: ..., status: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = insertSecurityLogRef(dataConnect, insertSecurityLogVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.securityLog_insert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.securityLog_insert);
});
```

## InsertDevice
You can execute the `InsertDevice` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
insertDevice(vars: InsertDeviceVariables): MutationPromise<InsertDeviceData, InsertDeviceVariables>;

interface InsertDeviceRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: InsertDeviceVariables): MutationRef<InsertDeviceData, InsertDeviceVariables>;
}
export const insertDeviceRef: InsertDeviceRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
insertDevice(dc: DataConnect, vars: InsertDeviceVariables): MutationPromise<InsertDeviceData, InsertDeviceVariables>;

interface InsertDeviceRef {
  ...
  (dc: DataConnect, vars: InsertDeviceVariables): MutationRef<InsertDeviceData, InsertDeviceVariables>;
}
export const insertDeviceRef: InsertDeviceRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the insertDeviceRef:
```typescript
const name = insertDeviceRef.operationName;
console.log(name);
```

### Variables
The `InsertDevice` mutation requires an argument of type `InsertDeviceVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface InsertDeviceVariables {
  userId: UUIDString;
  deviceName: string;
  osType: string;
  deviceModel: string;
  deviceIdHash: string;
}
```
### Return Type
Recall that executing the `InsertDevice` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `InsertDeviceData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface InsertDeviceData {
  device_insert: Device_Key;
}
```
### Using `InsertDevice`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, insertDevice, InsertDeviceVariables } from '@dataconnect/generated';

// The `InsertDevice` mutation requires an argument of type `InsertDeviceVariables`:
const insertDeviceVars: InsertDeviceVariables = {
  userId: ..., 
  deviceName: ..., 
  osType: ..., 
  deviceModel: ..., 
  deviceIdHash: ..., 
};

// Call the `insertDevice()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await insertDevice(insertDeviceVars);
// Variables can be defined inline as well.
const { data } = await insertDevice({ userId: ..., deviceName: ..., osType: ..., deviceModel: ..., deviceIdHash: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await insertDevice(dataConnect, insertDeviceVars);

console.log(data.device_insert);

// Or, you can use the `Promise` API.
insertDevice(insertDeviceVars).then((response) => {
  const data = response.data;
  console.log(data.device_insert);
});
```

### Using `InsertDevice`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, insertDeviceRef, InsertDeviceVariables } from '@dataconnect/generated';

// The `InsertDevice` mutation requires an argument of type `InsertDeviceVariables`:
const insertDeviceVars: InsertDeviceVariables = {
  userId: ..., 
  deviceName: ..., 
  osType: ..., 
  deviceModel: ..., 
  deviceIdHash: ..., 
};

// Call the `insertDeviceRef()` function to get a reference to the mutation.
const ref = insertDeviceRef(insertDeviceVars);
// Variables can be defined inline as well.
const ref = insertDeviceRef({ userId: ..., deviceName: ..., osType: ..., deviceModel: ..., deviceIdHash: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = insertDeviceRef(dataConnect, insertDeviceVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.device_insert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.device_insert);
});
```

