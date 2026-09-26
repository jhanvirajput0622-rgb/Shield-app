import { ConnectorConfig, DataConnect, QueryRef, QueryPromise, ExecuteQueryOptions, MutationRef, MutationPromise, DataConnectSettings } from 'firebase/data-connect';

export const connectorConfig: ConnectorConfig;
export const dataConnectSettings: DataConnectSettings;

export type TimestampString = string;
export type UUIDString = string;
export type Int64String = string;
export type DateString = string;




export interface Comment_Key {
  id: UUIDString;
  __typename?: 'Comment_Key';
}

export interface DeleteCommentData {
  comment_delete?: Comment_Key | null;
}

export interface DeleteCommentVariables {
  id: UUIDString;
}

export interface DeleteMilestoneData {
  milestone_delete?: Milestone_Key | null;
}

export interface DeleteMilestoneVariables {
  id: UUIDString;
}

export interface DeleteProjectData {
  project_delete?: Project_Key | null;
}

export interface DeleteProjectVariables {
  id: UUIDString;
}

export interface DeleteTaskData {
  task_delete?: Task_Key | null;
}

export interface DeleteTaskVariables {
  id: UUIDString;
}

export interface DeleteUserData {
  user_delete?: User_Key | null;
}

export interface GetCommentData {
  comment?: {
    content: string;
    author: {
      displayName: string;
    };
  };
}

export interface GetCommentVariables {
  id: UUIDString;
}

export interface GetCurrentUserData {
  user?: {
    displayName: string;
    email: string;
  };
}

export interface GetMilestoneData {
  milestone?: {
    title: string;
    project: {
      name: string;
    };
  };
}

export interface GetMilestoneVariables {
  id: UUIDString;
}

export interface GetProjectData {
  project?: {
    name: string;
    owner: {
      displayName: string;
    };
  };
}

export interface GetProjectVariables {
  id: UUIDString;
}

export interface GetTaskData {
  task?: {
    title: string;
    status: string;
  };
}

export interface GetTaskVariables {
  id: UUIDString;
}

export interface InsertCommentData {
  comment_insert: Comment_Key;
}

export interface InsertCommentVariables {
  taskId: UUIDString;
  content: string;
}

export interface InsertMilestoneData {
  milestone_insert: Milestone_Key;
}

export interface InsertMilestoneVariables {
  projectId: UUIDString;
  title: string;
}

export interface InsertProjectData {
  project_insert: Project_Key;
}

export interface InsertProjectVariables {
  name: string;
  description?: string | null;
}

export interface InsertTaskData {
  task_insert: Task_Key;
}

export interface InsertTaskVariables {
  projectId: UUIDString;
  title: string;
  status: string;
}

export interface InsertUserData {
  user_insert: User_Key;
}

export interface ListMilestonesData {
  milestones: ({
    title: string;
  })[];
}

export interface ListMilestonesVariables {
  projectId: UUIDString;
}

export interface ListMyProjectsData {
  projects: ({
    name: string;
  })[];
}

export interface ListTaskCommentsData {
  comments: ({
    content: string;
    createdAt?: TimestampString | null;
  })[];
}

export interface ListTaskCommentsVariables {
  taskId: UUIDString;
}

export interface ListTasksData {
  tasks: ({
    title: string;
  })[];
}

export interface ListTasksVariables {
  projectId: UUIDString;
}

export interface ListUsersData {
  users: ({
    displayName: string;
  })[];
}

export interface Milestone_Key {
  id: UUIDString;
  __typename?: 'Milestone_Key';
}

export interface Project_Key {
  id: UUIDString;
  __typename?: 'Project_Key';
}

export interface Task_Key {
  id: UUIDString;
  __typename?: 'Task_Key';
}

export interface UpdateCommentData {
  comment_update?: Comment_Key | null;
}

export interface UpdateCommentVariables {
  id: UUIDString;
  content: string;
}

export interface UpdateMilestoneData {
  milestone_update?: Milestone_Key | null;
}

export interface UpdateMilestoneVariables {
  id: UUIDString;
  isCompleted?: boolean | null;
}

export interface UpdateProjectData {
  project_update?: Project_Key | null;
}

export interface UpdateProjectVariables {
  id: UUIDString;
  name?: string | null;
}

export interface UpdateTaskData {
  task_update?: Task_Key | null;
}

export interface UpdateTaskVariables {
  id: UUIDString;
  status?: string | null;
}

export interface UpdateUserData {
  user_update?: User_Key | null;
}

export interface UpdateUserVariables {
  displayName: string;
}

export interface User_Key {
  id: UUIDString;
  __typename?: 'User_Key';
}

interface InsertUserRef {
  /* Allow users to create refs without passing in DataConnect */
  (): MutationRef<InsertUserData, undefined>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect): MutationRef<InsertUserData, undefined>;
  operationName: string;
}
export const insertUserRef: InsertUserRef;

export function insertUser(): MutationPromise<InsertUserData, undefined>;
export function insertUser(dc: DataConnect): MutationPromise<InsertUserData, undefined>;

interface UpdateUserRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateUserVariables): MutationRef<UpdateUserData, UpdateUserVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: UpdateUserVariables): MutationRef<UpdateUserData, UpdateUserVariables>;
  operationName: string;
}
export const updateUserRef: UpdateUserRef;

export function updateUser(vars: UpdateUserVariables): MutationPromise<UpdateUserData, UpdateUserVariables>;
export function updateUser(dc: DataConnect, vars: UpdateUserVariables): MutationPromise<UpdateUserData, UpdateUserVariables>;

interface DeleteUserRef {
  /* Allow users to create refs without passing in DataConnect */
  (): MutationRef<DeleteUserData, undefined>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect): MutationRef<DeleteUserData, undefined>;
  operationName: string;
}
export const deleteUserRef: DeleteUserRef;

export function deleteUser(): MutationPromise<DeleteUserData, undefined>;
export function deleteUser(dc: DataConnect): MutationPromise<DeleteUserData, undefined>;

interface GetCurrentUserRef {
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<GetCurrentUserData, undefined>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect): QueryRef<GetCurrentUserData, undefined>;
  operationName: string;
}
export const getCurrentUserRef: GetCurrentUserRef;

export function getCurrentUser(options?: ExecuteQueryOptions): QueryPromise<GetCurrentUserData, undefined>;
export function getCurrentUser(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<GetCurrentUserData, undefined>;

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

interface InsertProjectRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: InsertProjectVariables): MutationRef<InsertProjectData, InsertProjectVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: InsertProjectVariables): MutationRef<InsertProjectData, InsertProjectVariables>;
  operationName: string;
}
export const insertProjectRef: InsertProjectRef;

export function insertProject(vars: InsertProjectVariables): MutationPromise<InsertProjectData, InsertProjectVariables>;
export function insertProject(dc: DataConnect, vars: InsertProjectVariables): MutationPromise<InsertProjectData, InsertProjectVariables>;

interface UpdateProjectRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateProjectVariables): MutationRef<UpdateProjectData, UpdateProjectVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: UpdateProjectVariables): MutationRef<UpdateProjectData, UpdateProjectVariables>;
  operationName: string;
}
export const updateProjectRef: UpdateProjectRef;

export function updateProject(vars: UpdateProjectVariables): MutationPromise<UpdateProjectData, UpdateProjectVariables>;
export function updateProject(dc: DataConnect, vars: UpdateProjectVariables): MutationPromise<UpdateProjectData, UpdateProjectVariables>;

interface DeleteProjectRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: DeleteProjectVariables): MutationRef<DeleteProjectData, DeleteProjectVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: DeleteProjectVariables): MutationRef<DeleteProjectData, DeleteProjectVariables>;
  operationName: string;
}
export const deleteProjectRef: DeleteProjectRef;

export function deleteProject(vars: DeleteProjectVariables): MutationPromise<DeleteProjectData, DeleteProjectVariables>;
export function deleteProject(dc: DataConnect, vars: DeleteProjectVariables): MutationPromise<DeleteProjectData, DeleteProjectVariables>;

interface GetProjectRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetProjectVariables): QueryRef<GetProjectData, GetProjectVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: GetProjectVariables): QueryRef<GetProjectData, GetProjectVariables>;
  operationName: string;
}
export const getProjectRef: GetProjectRef;

export function getProject(vars: GetProjectVariables, options?: ExecuteQueryOptions): QueryPromise<GetProjectData, GetProjectVariables>;
export function getProject(dc: DataConnect, vars: GetProjectVariables, options?: ExecuteQueryOptions): QueryPromise<GetProjectData, GetProjectVariables>;

interface ListMyProjectsRef {
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<ListMyProjectsData, undefined>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect): QueryRef<ListMyProjectsData, undefined>;
  operationName: string;
}
export const listMyProjectsRef: ListMyProjectsRef;

export function listMyProjects(options?: ExecuteQueryOptions): QueryPromise<ListMyProjectsData, undefined>;
export function listMyProjects(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<ListMyProjectsData, undefined>;

interface InsertMilestoneRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: InsertMilestoneVariables): MutationRef<InsertMilestoneData, InsertMilestoneVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: InsertMilestoneVariables): MutationRef<InsertMilestoneData, InsertMilestoneVariables>;
  operationName: string;
}
export const insertMilestoneRef: InsertMilestoneRef;

export function insertMilestone(vars: InsertMilestoneVariables): MutationPromise<InsertMilestoneData, InsertMilestoneVariables>;
export function insertMilestone(dc: DataConnect, vars: InsertMilestoneVariables): MutationPromise<InsertMilestoneData, InsertMilestoneVariables>;

interface UpdateMilestoneRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateMilestoneVariables): MutationRef<UpdateMilestoneData, UpdateMilestoneVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: UpdateMilestoneVariables): MutationRef<UpdateMilestoneData, UpdateMilestoneVariables>;
  operationName: string;
}
export const updateMilestoneRef: UpdateMilestoneRef;

export function updateMilestone(vars: UpdateMilestoneVariables): MutationPromise<UpdateMilestoneData, UpdateMilestoneVariables>;
export function updateMilestone(dc: DataConnect, vars: UpdateMilestoneVariables): MutationPromise<UpdateMilestoneData, UpdateMilestoneVariables>;

interface DeleteMilestoneRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: DeleteMilestoneVariables): MutationRef<DeleteMilestoneData, DeleteMilestoneVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: DeleteMilestoneVariables): MutationRef<DeleteMilestoneData, DeleteMilestoneVariables>;
  operationName: string;
}
export const deleteMilestoneRef: DeleteMilestoneRef;

export function deleteMilestone(vars: DeleteMilestoneVariables): MutationPromise<DeleteMilestoneData, DeleteMilestoneVariables>;
export function deleteMilestone(dc: DataConnect, vars: DeleteMilestoneVariables): MutationPromise<DeleteMilestoneData, DeleteMilestoneVariables>;

interface GetMilestoneRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetMilestoneVariables): QueryRef<GetMilestoneData, GetMilestoneVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: GetMilestoneVariables): QueryRef<GetMilestoneData, GetMilestoneVariables>;
  operationName: string;
}
export const getMilestoneRef: GetMilestoneRef;

export function getMilestone(vars: GetMilestoneVariables, options?: ExecuteQueryOptions): QueryPromise<GetMilestoneData, GetMilestoneVariables>;
export function getMilestone(dc: DataConnect, vars: GetMilestoneVariables, options?: ExecuteQueryOptions): QueryPromise<GetMilestoneData, GetMilestoneVariables>;

interface ListMilestonesRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: ListMilestonesVariables): QueryRef<ListMilestonesData, ListMilestonesVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: ListMilestonesVariables): QueryRef<ListMilestonesData, ListMilestonesVariables>;
  operationName: string;
}
export const listMilestonesRef: ListMilestonesRef;

export function listMilestones(vars: ListMilestonesVariables, options?: ExecuteQueryOptions): QueryPromise<ListMilestonesData, ListMilestonesVariables>;
export function listMilestones(dc: DataConnect, vars: ListMilestonesVariables, options?: ExecuteQueryOptions): QueryPromise<ListMilestonesData, ListMilestonesVariables>;

interface InsertTaskRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: InsertTaskVariables): MutationRef<InsertTaskData, InsertTaskVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: InsertTaskVariables): MutationRef<InsertTaskData, InsertTaskVariables>;
  operationName: string;
}
export const insertTaskRef: InsertTaskRef;

export function insertTask(vars: InsertTaskVariables): MutationPromise<InsertTaskData, InsertTaskVariables>;
export function insertTask(dc: DataConnect, vars: InsertTaskVariables): MutationPromise<InsertTaskData, InsertTaskVariables>;

interface UpdateTaskRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateTaskVariables): MutationRef<UpdateTaskData, UpdateTaskVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: UpdateTaskVariables): MutationRef<UpdateTaskData, UpdateTaskVariables>;
  operationName: string;
}
export const updateTaskRef: UpdateTaskRef;

export function updateTask(vars: UpdateTaskVariables): MutationPromise<UpdateTaskData, UpdateTaskVariables>;
export function updateTask(dc: DataConnect, vars: UpdateTaskVariables): MutationPromise<UpdateTaskData, UpdateTaskVariables>;

interface DeleteTaskRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: DeleteTaskVariables): MutationRef<DeleteTaskData, DeleteTaskVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: DeleteTaskVariables): MutationRef<DeleteTaskData, DeleteTaskVariables>;
  operationName: string;
}
export const deleteTaskRef: DeleteTaskRef;

export function deleteTask(vars: DeleteTaskVariables): MutationPromise<DeleteTaskData, DeleteTaskVariables>;
export function deleteTask(dc: DataConnect, vars: DeleteTaskVariables): MutationPromise<DeleteTaskData, DeleteTaskVariables>;

interface GetTaskRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetTaskVariables): QueryRef<GetTaskData, GetTaskVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: GetTaskVariables): QueryRef<GetTaskData, GetTaskVariables>;
  operationName: string;
}
export const getTaskRef: GetTaskRef;

export function getTask(vars: GetTaskVariables, options?: ExecuteQueryOptions): QueryPromise<GetTaskData, GetTaskVariables>;
export function getTask(dc: DataConnect, vars: GetTaskVariables, options?: ExecuteQueryOptions): QueryPromise<GetTaskData, GetTaskVariables>;

interface ListTasksRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: ListTasksVariables): QueryRef<ListTasksData, ListTasksVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: ListTasksVariables): QueryRef<ListTasksData, ListTasksVariables>;
  operationName: string;
}
export const listTasksRef: ListTasksRef;

export function listTasks(vars: ListTasksVariables, options?: ExecuteQueryOptions): QueryPromise<ListTasksData, ListTasksVariables>;
export function listTasks(dc: DataConnect, vars: ListTasksVariables, options?: ExecuteQueryOptions): QueryPromise<ListTasksData, ListTasksVariables>;

interface InsertCommentRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: InsertCommentVariables): MutationRef<InsertCommentData, InsertCommentVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: InsertCommentVariables): MutationRef<InsertCommentData, InsertCommentVariables>;
  operationName: string;
}
export const insertCommentRef: InsertCommentRef;

export function insertComment(vars: InsertCommentVariables): MutationPromise<InsertCommentData, InsertCommentVariables>;
export function insertComment(dc: DataConnect, vars: InsertCommentVariables): MutationPromise<InsertCommentData, InsertCommentVariables>;

interface UpdateCommentRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateCommentVariables): MutationRef<UpdateCommentData, UpdateCommentVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: UpdateCommentVariables): MutationRef<UpdateCommentData, UpdateCommentVariables>;
  operationName: string;
}
export const updateCommentRef: UpdateCommentRef;

export function updateComment(vars: UpdateCommentVariables): MutationPromise<UpdateCommentData, UpdateCommentVariables>;
export function updateComment(dc: DataConnect, vars: UpdateCommentVariables): MutationPromise<UpdateCommentData, UpdateCommentVariables>;

interface DeleteCommentRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: DeleteCommentVariables): MutationRef<DeleteCommentData, DeleteCommentVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: DeleteCommentVariables): MutationRef<DeleteCommentData, DeleteCommentVariables>;
  operationName: string;
}
export const deleteCommentRef: DeleteCommentRef;

export function deleteComment(vars: DeleteCommentVariables): MutationPromise<DeleteCommentData, DeleteCommentVariables>;
export function deleteComment(dc: DataConnect, vars: DeleteCommentVariables): MutationPromise<DeleteCommentData, DeleteCommentVariables>;

interface GetCommentRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetCommentVariables): QueryRef<GetCommentData, GetCommentVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: GetCommentVariables): QueryRef<GetCommentData, GetCommentVariables>;
  operationName: string;
}
export const getCommentRef: GetCommentRef;

export function getComment(vars: GetCommentVariables, options?: ExecuteQueryOptions): QueryPromise<GetCommentData, GetCommentVariables>;
export function getComment(dc: DataConnect, vars: GetCommentVariables, options?: ExecuteQueryOptions): QueryPromise<GetCommentData, GetCommentVariables>;

interface ListTaskCommentsRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: ListTaskCommentsVariables): QueryRef<ListTaskCommentsData, ListTaskCommentsVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: ListTaskCommentsVariables): QueryRef<ListTaskCommentsData, ListTaskCommentsVariables>;
  operationName: string;
}
export const listTaskCommentsRef: ListTaskCommentsRef;

export function listTaskComments(vars: ListTaskCommentsVariables, options?: ExecuteQueryOptions): QueryPromise<ListTaskCommentsData, ListTaskCommentsVariables>;
export function listTaskComments(dc: DataConnect, vars: ListTaskCommentsVariables, options?: ExecuteQueryOptions): QueryPromise<ListTaskCommentsData, ListTaskCommentsVariables>;

