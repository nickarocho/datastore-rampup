import { ModelInit, MutableModel, PersistentModelConstructor } from "@aws-amplify/datastore";

export enum PostStatus {
  DRAFT = "DRAFT",
  PUBLISHED = "PUBLISHED"
}



export declare class Post {
  readonly id: string;
  readonly title: string;
  readonly status: PostStatus | keyof typeof PostStatus;
  readonly color?: string;
  readonly content?: string;
  readonly votes?: number;
  constructor(init: ModelInit<Post>);
  static copyOf(source: Post, mutator: (draft: MutableModel<Post>) => MutableModel<Post> | void): Post;
}