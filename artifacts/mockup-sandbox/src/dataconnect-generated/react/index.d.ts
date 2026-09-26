import { InsertUserData, UpdateUserData, UpdateUserVariables, DeleteUserData, GetCurrentUserData, ListUsersData, InsertProjectData, InsertProjectVariables, UpdateProjectData, UpdateProjectVariables, DeleteProjectData, DeleteProjectVariables, GetProjectData, GetProjectVariables, ListMyProjectsData, InsertMilestoneData, InsertMilestoneVariables, UpdateMilestoneData, UpdateMilestoneVariables, DeleteMilestoneData, DeleteMilestoneVariables, GetMilestoneData, GetMilestoneVariables, ListMilestonesData, ListMilestonesVariables, InsertTaskData, InsertTaskVariables, UpdateTaskData, UpdateTaskVariables, DeleteTaskData, DeleteTaskVariables, GetTaskData, GetTaskVariables, ListTasksData, ListTasksVariables, InsertCommentData, InsertCommentVariables, UpdateCommentData, UpdateCommentVariables, DeleteCommentData, DeleteCommentVariables, GetCommentData, GetCommentVariables, ListTaskCommentsData, ListTaskCommentsVariables } from '../';
import { UseDataConnectQueryResult, useDataConnectQueryOptions, UseDataConnectMutationResult, useDataConnectMutationOptions} from '@tanstack-query-firebase/react/data-connect';
import { UseQueryResult, UseMutationResult} from '@tanstack/react-query';
import { DataConnect } from 'firebase/data-connect';
import { FirebaseError } from 'firebase/app';


export function useInsertUser(options?: useDataConnectMutationOptions<InsertUserData, FirebaseError, void>): UseDataConnectMutationResult<InsertUserData, undefined>;
export function useInsertUser(dc: DataConnect, options?: useDataConnectMutationOptions<InsertUserData, FirebaseError, void>): UseDataConnectMutationResult<InsertUserData, undefined>;

export function useUpdateUser(options?: useDataConnectMutationOptions<UpdateUserData, FirebaseError, UpdateUserVariables>): UseDataConnectMutationResult<UpdateUserData, UpdateUserVariables>;
export function useUpdateUser(dc: DataConnect, options?: useDataConnectMutationOptions<UpdateUserData, FirebaseError, UpdateUserVariables>): UseDataConnectMutationResult<UpdateUserData, UpdateUserVariables>;

export function useDeleteUser(options?: useDataConnectMutationOptions<DeleteUserData, FirebaseError, void>): UseDataConnectMutationResult<DeleteUserData, undefined>;
export function useDeleteUser(dc: DataConnect, options?: useDataConnectMutationOptions<DeleteUserData, FirebaseError, void>): UseDataConnectMutationResult<DeleteUserData, undefined>;

export function useGetCurrentUser(options?: useDataConnectQueryOptions<GetCurrentUserData>): UseDataConnectQueryResult<GetCurrentUserData, undefined>;
export function useGetCurrentUser(dc: DataConnect, options?: useDataConnectQueryOptions<GetCurrentUserData>): UseDataConnectQueryResult<GetCurrentUserData, undefined>;

export function useListUsers(options?: useDataConnectQueryOptions<ListUsersData>): UseDataConnectQueryResult<ListUsersData, undefined>;
export function useListUsers(dc: DataConnect, options?: useDataConnectQueryOptions<ListUsersData>): UseDataConnectQueryResult<ListUsersData, undefined>;

export function useInsertProject(options?: useDataConnectMutationOptions<InsertProjectData, FirebaseError, InsertProjectVariables>): UseDataConnectMutationResult<InsertProjectData, InsertProjectVariables>;
export function useInsertProject(dc: DataConnect, options?: useDataConnectMutationOptions<InsertProjectData, FirebaseError, InsertProjectVariables>): UseDataConnectMutationResult<InsertProjectData, InsertProjectVariables>;

export function useUpdateProject(options?: useDataConnectMutationOptions<UpdateProjectData, FirebaseError, UpdateProjectVariables>): UseDataConnectMutationResult<UpdateProjectData, UpdateProjectVariables>;
export function useUpdateProject(dc: DataConnect, options?: useDataConnectMutationOptions<UpdateProjectData, FirebaseError, UpdateProjectVariables>): UseDataConnectMutationResult<UpdateProjectData, UpdateProjectVariables>;

export function useDeleteProject(options?: useDataConnectMutationOptions<DeleteProjectData, FirebaseError, DeleteProjectVariables>): UseDataConnectMutationResult<DeleteProjectData, DeleteProjectVariables>;
export function useDeleteProject(dc: DataConnect, options?: useDataConnectMutationOptions<DeleteProjectData, FirebaseError, DeleteProjectVariables>): UseDataConnectMutationResult<DeleteProjectData, DeleteProjectVariables>;

export function useGetProject(vars: GetProjectVariables, options?: useDataConnectQueryOptions<GetProjectData>): UseDataConnectQueryResult<GetProjectData, GetProjectVariables>;
export function useGetProject(dc: DataConnect, vars: GetProjectVariables, options?: useDataConnectQueryOptions<GetProjectData>): UseDataConnectQueryResult<GetProjectData, GetProjectVariables>;

export function useListMyProjects(options?: useDataConnectQueryOptions<ListMyProjectsData>): UseDataConnectQueryResult<ListMyProjectsData, undefined>;
export function useListMyProjects(dc: DataConnect, options?: useDataConnectQueryOptions<ListMyProjectsData>): UseDataConnectQueryResult<ListMyProjectsData, undefined>;

export function useInsertMilestone(options?: useDataConnectMutationOptions<InsertMilestoneData, FirebaseError, InsertMilestoneVariables>): UseDataConnectMutationResult<InsertMilestoneData, InsertMilestoneVariables>;
export function useInsertMilestone(dc: DataConnect, options?: useDataConnectMutationOptions<InsertMilestoneData, FirebaseError, InsertMilestoneVariables>): UseDataConnectMutationResult<InsertMilestoneData, InsertMilestoneVariables>;

export function useUpdateMilestone(options?: useDataConnectMutationOptions<UpdateMilestoneData, FirebaseError, UpdateMilestoneVariables>): UseDataConnectMutationResult<UpdateMilestoneData, UpdateMilestoneVariables>;
export function useUpdateMilestone(dc: DataConnect, options?: useDataConnectMutationOptions<UpdateMilestoneData, FirebaseError, UpdateMilestoneVariables>): UseDataConnectMutationResult<UpdateMilestoneData, UpdateMilestoneVariables>;

export function useDeleteMilestone(options?: useDataConnectMutationOptions<DeleteMilestoneData, FirebaseError, DeleteMilestoneVariables>): UseDataConnectMutationResult<DeleteMilestoneData, DeleteMilestoneVariables>;
export function useDeleteMilestone(dc: DataConnect, options?: useDataConnectMutationOptions<DeleteMilestoneData, FirebaseError, DeleteMilestoneVariables>): UseDataConnectMutationResult<DeleteMilestoneData, DeleteMilestoneVariables>;

export function useGetMilestone(vars: GetMilestoneVariables, options?: useDataConnectQueryOptions<GetMilestoneData>): UseDataConnectQueryResult<GetMilestoneData, GetMilestoneVariables>;
export function useGetMilestone(dc: DataConnect, vars: GetMilestoneVariables, options?: useDataConnectQueryOptions<GetMilestoneData>): UseDataConnectQueryResult<GetMilestoneData, GetMilestoneVariables>;

export function useListMilestones(vars: ListMilestonesVariables, options?: useDataConnectQueryOptions<ListMilestonesData>): UseDataConnectQueryResult<ListMilestonesData, ListMilestonesVariables>;
export function useListMilestones(dc: DataConnect, vars: ListMilestonesVariables, options?: useDataConnectQueryOptions<ListMilestonesData>): UseDataConnectQueryResult<ListMilestonesData, ListMilestonesVariables>;

export function useInsertTask(options?: useDataConnectMutationOptions<InsertTaskData, FirebaseError, InsertTaskVariables>): UseDataConnectMutationResult<InsertTaskData, InsertTaskVariables>;
export function useInsertTask(dc: DataConnect, options?: useDataConnectMutationOptions<InsertTaskData, FirebaseError, InsertTaskVariables>): UseDataConnectMutationResult<InsertTaskData, InsertTaskVariables>;

export function useUpdateTask(options?: useDataConnectMutationOptions<UpdateTaskData, FirebaseError, UpdateTaskVariables>): UseDataConnectMutationResult<UpdateTaskData, UpdateTaskVariables>;
export function useUpdateTask(dc: DataConnect, options?: useDataConnectMutationOptions<UpdateTaskData, FirebaseError, UpdateTaskVariables>): UseDataConnectMutationResult<UpdateTaskData, UpdateTaskVariables>;

export function useDeleteTask(options?: useDataConnectMutationOptions<DeleteTaskData, FirebaseError, DeleteTaskVariables>): UseDataConnectMutationResult<DeleteTaskData, DeleteTaskVariables>;
export function useDeleteTask(dc: DataConnect, options?: useDataConnectMutationOptions<DeleteTaskData, FirebaseError, DeleteTaskVariables>): UseDataConnectMutationResult<DeleteTaskData, DeleteTaskVariables>;

export function useGetTask(vars: GetTaskVariables, options?: useDataConnectQueryOptions<GetTaskData>): UseDataConnectQueryResult<GetTaskData, GetTaskVariables>;
export function useGetTask(dc: DataConnect, vars: GetTaskVariables, options?: useDataConnectQueryOptions<GetTaskData>): UseDataConnectQueryResult<GetTaskData, GetTaskVariables>;

export function useListTasks(vars: ListTasksVariables, options?: useDataConnectQueryOptions<ListTasksData>): UseDataConnectQueryResult<ListTasksData, ListTasksVariables>;
export function useListTasks(dc: DataConnect, vars: ListTasksVariables, options?: useDataConnectQueryOptions<ListTasksData>): UseDataConnectQueryResult<ListTasksData, ListTasksVariables>;

export function useInsertComment(options?: useDataConnectMutationOptions<InsertCommentData, FirebaseError, InsertCommentVariables>): UseDataConnectMutationResult<InsertCommentData, InsertCommentVariables>;
export function useInsertComment(dc: DataConnect, options?: useDataConnectMutationOptions<InsertCommentData, FirebaseError, InsertCommentVariables>): UseDataConnectMutationResult<InsertCommentData, InsertCommentVariables>;

export function useUpdateComment(options?: useDataConnectMutationOptions<UpdateCommentData, FirebaseError, UpdateCommentVariables>): UseDataConnectMutationResult<UpdateCommentData, UpdateCommentVariables>;
export function useUpdateComment(dc: DataConnect, options?: useDataConnectMutationOptions<UpdateCommentData, FirebaseError, UpdateCommentVariables>): UseDataConnectMutationResult<UpdateCommentData, UpdateCommentVariables>;

export function useDeleteComment(options?: useDataConnectMutationOptions<DeleteCommentData, FirebaseError, DeleteCommentVariables>): UseDataConnectMutationResult<DeleteCommentData, DeleteCommentVariables>;
export function useDeleteComment(dc: DataConnect, options?: useDataConnectMutationOptions<DeleteCommentData, FirebaseError, DeleteCommentVariables>): UseDataConnectMutationResult<DeleteCommentData, DeleteCommentVariables>;

export function useGetComment(vars: GetCommentVariables, options?: useDataConnectQueryOptions<GetCommentData>): UseDataConnectQueryResult<GetCommentData, GetCommentVariables>;
export function useGetComment(dc: DataConnect, vars: GetCommentVariables, options?: useDataConnectQueryOptions<GetCommentData>): UseDataConnectQueryResult<GetCommentData, GetCommentVariables>;

export function useListTaskComments(vars: ListTaskCommentsVariables, options?: useDataConnectQueryOptions<ListTaskCommentsData>): UseDataConnectQueryResult<ListTaskCommentsData, ListTaskCommentsVariables>;
export function useListTaskComments(dc: DataConnect, vars: ListTaskCommentsVariables, options?: useDataConnectQueryOptions<ListTaskCommentsData>): UseDataConnectQueryResult<ListTaskCommentsData, ListTaskCommentsVariables>;
