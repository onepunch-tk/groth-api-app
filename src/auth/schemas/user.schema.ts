import { HydratedDocument } from 'mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Role, Social } from '../interfaces/social-user.interface';

export type UserDocument = HydratedDocument<User>;

@Schema()
export class User {
  @Prop({
    unique: true,
    required: true,
  })
  username: string;
  @Prop()
  password: string;
  @Prop()
  nickname: string;
  @Prop({ enum: Social, type: String })
  social: Social;
  @Prop({
    enum: Role,
    type: String,
    default: Role.USER,
    required: false,
  })
  role: Role;
}

export const UserSchema = SchemaFactory.createForClass(User);
