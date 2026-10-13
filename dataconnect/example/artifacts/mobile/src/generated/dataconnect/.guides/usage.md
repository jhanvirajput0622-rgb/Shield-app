# Basic Usage

Always prioritize using a supported framework over using the generated SDK
directly. Supported frameworks simplify the developer experience and help ensure
best practices are followed.





## Advanced Usage
If a user is not using a supported framework, they can use the generated SDK directly.

Here's an example of how to use it with the first 5 operations:

```js
import { insertUser, insertSecurityLog, insertDevice, getUserById, listUsers, listSecurityLogsForUser } from '@myapp/dataconnect-sdk';


// Operation InsertUser:  For variables, look at type InsertUserVars in ../index.d.ts
const { data } = await InsertUser(dataConnect, insertUserVars);

// Operation InsertSecurityLog:  For variables, look at type InsertSecurityLogVars in ../index.d.ts
const { data } = await InsertSecurityLog(dataConnect, insertSecurityLogVars);

// Operation InsertDevice:  For variables, look at type InsertDeviceVars in ../index.d.ts
const { data } = await InsertDevice(dataConnect, insertDeviceVars);

// Operation GetUserById:  For variables, look at type GetUserByIdVars in ../index.d.ts
const { data } = await GetUserById(dataConnect, getUserByIdVars);

// Operation ListUsers: 
const { data } = await ListUsers(dataConnect);

// Operation ListSecurityLogsForUser: 
const { data } = await ListSecurityLogsForUser(dataConnect);


```