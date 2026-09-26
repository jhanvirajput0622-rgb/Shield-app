import { ConnectorConfig, DataConnect, OperationOptions, ExecuteOperationResponse } from 'firebase-admin/data-connect';

export const connectorConfig: ConnectorConfig;

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

/** Generated Node Admin SDK operation action function for the 'InsertUser' Mutation. Allow users to execute without passing in DataConnect. */
export function insertUser(dc: DataConnect, options?: OperationOptions): Promise<ExecuteOperationResponse<InsertUserData>>;
/** Generated Node Admin SDK operation action function for the 'InsertUser' Mutation. Allow users to pass in custom DataConnect instances. */
export function insertUser(options?: OperationOptions): Promise<ExecuteOperationResponse<InsertUserData>>;

/** Generated Node Admin SDK operation action function for the 'UpdateUser' Mutation. Allow users to execute without passing in DataConnect. */
export function updateUser(dc: DataConnect, vars: UpdateUserVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateUserData>>;
/** Generated Node Admin SDK operation action function for the 'UpdateUser' Mutation. Allow users to pass in custom DataConnect instances. */
export function updateUser(vars: UpdateUserVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateUserData>>;

/** Generated Node Admin SDK operation action function for the 'DeleteUser' Mutation. Allow users to execute without passing in DataConnect. */
export function deleteUser(dc: DataConnect, options?: OperationOptions): Promise<ExecuteOperationResponse<DeleteUserData>>;
/** Generated Node Admin SDK operation action function for the 'DeleteUser' Mutation. Allow users to pass in custom DataConnect instances. */
export function deleteUser(options?: OperationOptions): Promise<ExecuteOperationResponse<DeleteUserData>>;

/** Generated Node Admin SDK operation action function for the 'GetCurrentUser' Query. Allow users to execute without passing in DataConnect. */
export function getCurrentUser(dc: DataConnect, options?: OperationOptions): Promise<ExecuteOperationResponse<GetCurrentUserData>>;
/** Generated Node Admin SDK operation action function for the 'GetCurrentUser' Query. Allow users to pass in custom DataConnect instances. */
export function getCurrentUser(options?: OperationOptions): Promise<ExecuteOperationResponse<GetCurrentUserData>>;

/** Generated Node Admin SDK operation action function for the 'ListUsers' Query. Allow users to execute without passing in DataConnect. */
export function listUsers(dc: DataConnect, options?: OperationOptions): Promise<ExecuteOperationResponse<ListUsersData>>;
/** Generated Node Admin SDK operation action function for the 'ListUsers' Query. Allow users to pass in custom DataConnect instances. */
export function listUsers(options?: OperationOptions): Promise<ExecuteOperationResponse<ListUsersData>>;

/** Generated Node Admin SDK operation action function for the 'InsertProject' Mutation. Allow users to execute without passing in DataConnect. */
export function insertProject(dc: DataConnect, vars: InsertProjectVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<InsertProjectData>>;
/** Generated Node Admin SDK operation action function for the 'InsertProject' Mutation. Allow users to pass in custom DataConnect instances. */
export function insertProject(vars: InsertProjectVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<InsertProjectData>>;

/** Generated Node Admin SDK operation action function for the 'UpdateProject' Mutation. Allow users to execute without passing in DataConnect. */
export function updateProject(dc: DataConnect, vars: UpdateProjectVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateProjectData>>;
/** Generated Node Admin SDK operation action function for the 'UpdateProject' Mutation. Allow users to pass in custom DataConnect instances. */
export function updateProject(vars: UpdateProjectVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateProjectData>>;

/** Generated Node Admin SDK operation action function for the 'DeleteProject' Mutation. Allow users to execute without passing in DataConnect. */
export function deleteProject(dc: DataConnect, vars: DeleteProjectVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<DeleteProjectData>>;
/** Generated Node Admin SDK operation action function for the 'DeleteProject' Mutation. Allow users to pass in custom DataConnect instances. */
export function deleteProject(vars: DeleteProjectVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<DeleteProjectData>>;

/** Generated Node Admin SDK operation action function for the 'GetProject' Query. Allow users to execute without passing in DataConnect. */
export function getProject(dc: DataConnect, vars: GetProjectVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetProjectData>>;
/** Generated Node Admin SDK operation action function for the 'GetProject' Query. Allow users to pass in custom DataConnect instances. */
export function getProject(vars: GetProjectVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetProjectData>>;

/** Generated Node Admin SDK operation action function for the 'ListMyProjects' Query. Allow users to execute without passing in DataConnect. */
export function listMyProjects(dc: DataConnect, options?: OperationOptions): Promise<ExecuteOperationResponse<ListMyProjectsData>>;
/** Generated Node Admin SDK operation action function for the 'ListMyProjects' Query. Allow users to pass in custom DataConnect instances. */
export function listMyProjects(options?: OperationOptions): Promise<ExecuteOperationResponse<ListMyProjectsData>>;

/** Generated Node Admin SDK operation action function for the 'InsertMilestone' Mutation. Allow users to execute without passing in DataConnect. */
export function insertMilestone(dc: DataConnect, vars: InsertMilestoneVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<InsertMilestoneData>>;
/** Generated Node Admin SDK operation action function for the 'InsertMilestone' Mutation. Allow users to pass in custom DataConnect instances. */
export function insertMilestone(vars: InsertMilestoneVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<InsertMilestoneData>>;

/** Generated Node Admin SDK operation action function for the 'UpdateMilestone' Mutation. Allow users to execute without passing in DataConnect. */
export function updateMilestone(dc: DataConnect, vars: UpdateMilestoneVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateMilestoneData>>;
/** Generated Node Admin SDK operation action function for the 'UpdateMilestone' Mutation. Allow users to pass in custom DataConnect instances. */
export function updateMilestone(vars: UpdateMilestoneVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateMilestoneData>>;

/** Generated Node Admin SDK operation action function for the 'DeleteMilestone' Mutation. Allow users to execute without passing in DataConnect. */
export function deleteMilestone(dc: DataConnect, vars: DeleteMilestoneVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<DeleteMilestoneData>>;
/** Generated Node Admin SDK operation action function for the 'DeleteMilestone' Mutation. Allow users to pass in custom DataConnect instances. */
export function deleteMilestone(vars: DeleteMilestoneVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<DeleteMilestoneData>>;

/** Generated Node Admin SDK operation action function for the 'GetMilestone' Query. Allow users to execute without passing in DataConnect. */
export function getMilestone(dc: DataConnect, vars: GetMilestoneVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetMilestoneData>>;
/** Generated Node Admin SDK operation action function for the 'GetMilestone' Query. Allow users to pass in custom DataConnect instances. */
export function getMilestone(vars: GetMilestoneVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetMilestoneData>>;

/** Generated Node Admin SDK operation action function for the 'ListMilestones' Query. Allow users to execute without passing in DataConnect. */
export function listMilestones(dc: DataConnect, vars: ListMilestonesVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListMilestonesData>>;
/** Generated Node Admin SDK operation action function for the 'ListMilestones' Query. Allow users to pass in custom DataConnect instances. */
export function listMilestones(vars: ListMilestonesVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListMilestonesData>>;

/** Generated Node Admin SDK operation action function for the 'InsertTask' Mutation. Allow users to execute without passing in DataConnect. */
export function insertTask(dc: DataConnect, vars: InsertTaskVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<InsertTaskData>>;
/** Generated Node Admin SDK operation action function for the 'InsertTask' Mutation. Allow users to pass in custom DataConnect instances. */
export function insertTask(vars: InsertTaskVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<InsertTaskData>>;

/** Generated Node Admin SDK operation action function for the 'UpdateTask' Mutation. Allow users to execute without passing in DataConnect. */
export function updateTask(dc: DataConnect, vars: UpdateTaskVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateTaskData>>;
/** Generated Node Admin SDK operation action function for the 'UpdateTask' Mutation. Allow users to pass in custom DataConnect instances. */
export function updateTask(vars: UpdateTaskVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateTaskData>>;

/** Generated Node Admin SDK operation action function for the 'DeleteTask' Mutation. Allow users to execute without passing in DataConnect. */
export function deleteTask(dc: DataConnect, vars: DeleteTaskVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<DeleteTaskData>>;
/** Generated Node Admin SDK operation action function for the 'DeleteTask' Mutation. Allow users to pass in custom DataConnect instances. */
export function deleteTask(vars: DeleteTaskVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<DeleteTaskData>>;

/** Generated Node Admin SDK operation action function for the 'GetTask' Query. Allow users to execute without passing in DataConnect. */
export function getTask(dc: DataConnect, vars: GetTaskVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetTaskData>>;
/** Generated Node Admin SDK operation action function for the 'GetTask' Query. Allow users to pass in custom DataConnect instances. */
export function getTask(vars: GetTaskVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetTaskData>>;

/** Generated Node Admin SDK operation action function for the 'ListTasks' Query. Allow users to execute without passing in DataConnect. */
export function listTasks(dc: DataConnect, vars: ListTasksVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListTasksData>>;
/** Generated Node Admin SDK operation action function for the 'ListTasks' Query. Allow users to pass in custom DataConnect instances. */
export function listTasks(vars: ListTasksVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListTasksData>>;

/** Generated Node Admin SDK operation action function for the 'InsertComment' Mutation. Allow users to execute without passing in DataConnect. */
export function insertComment(dc: DataConnect, vars: InsertCommentVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<InsertCommentData>>;
/** Generated Node Admin SDK operation action function for the 'InsertComment' Mutation. Allow users to pass in custom DataConnect instances. */
export function insertComment(vars: InsertCommentVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<InsertCommentData>>;

/** Generated Node Admin SDK operation action function for the 'UpdateComment' Mutation. Allow users to execute without passing in DataConnect. */
export function updateComment(dc: DataConnect, vars: UpdateCommentVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateCommentData>>;
/** Generated Node Admin SDK operation action function for the 'UpdateComment' Mutation. Allow users to pass in custom DataConnect instances. */
export function updateComment(vars: UpdateCommentVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateCommentData>>;

/** Generated Node Admin SDK operation action function for the 'DeleteComment' Mutation. Allow users to execute without passing in DataConnect. */
export function deleteComment(dc: DataConnect, vars: DeleteCommentVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<DeleteCommentData>>;
/** Generated Node Admin SDK operation action function for the 'DeleteComment' Mutation. Allow users to pass in custom DataConnect instances. */
export function deleteComment(vars: DeleteCommentVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<DeleteCommentData>>;

/** Generated Node Admin SDK operation action function for the 'GetComment' Query. Allow users to execute without passing in DataConnect. */
export function getComment(dc: DataConnect, vars: GetCommentVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetCommentData>>;
/** Generated Node Admin SDK operation action function for the 'GetComment' Query. Allow users to pass in custom DataConnect instances. */
export function getComment(vars: GetCommentVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetCommentData>>;

/** Generated Node Admin SDK operation action function for the 'ListTaskComments' Query. Allow users to execute without passing in DataConnect. */
export function listTaskComments(dc: DataConnect, vars: ListTaskCommentsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListTaskCommentsData>>;
/** Generated Node Admin SDK operation action function for the 'ListTaskComments' Query. Allow users to pass in custom DataConnect instances. */
export function listTaskComments(vars: ListTaskCommentsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListTaskCommentsData>>;

