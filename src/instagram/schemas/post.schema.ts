import { HydratedDocument, Types } from 'mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { PostStatus } from '../interfaces/post.interface';

export type PostDocument = HydratedDocument<Post>;

@Schema({ timestamps: true })
export class Post {
  @Prop()
  username: string;
  @Prop()
  password: string;
  @Prop({ enum: PostStatus, type: String, default: PostStatus.WAIT })
  status: PostStatus;
  @Prop({
    required: false,
  })
  postId: string;
  @Prop()
  imgSrc: string;

  @Prop({ required: false })
  caption: string;

  @Prop()
  isMobile: boolean;

  @Prop({ required: false })
  scheduledPublishDate: Date;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  requester: Types.ObjectId;
}

export const PostSchema = SchemaFactory.createForClass(Post);
