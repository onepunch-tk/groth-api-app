import { Injectable } from '@nestjs/common';
import { ISocialUser } from './interfaces/social-user.interface';
import { InjectModel } from '@nestjs/mongoose';
import { User } from './schemas/user.schema';
import { Model } from 'mongoose';

@Injectable()
export class AuthService {
  constructor(@InjectModel(User.name) private userModel: Model<User>) {}
  async OAuthSignIn(socialUser: ISocialUser) {
    try {
      const alreadyUser = await this.userModel.findOne({
        username: socialUser.username,
      });

      if (!alreadyUser) {
        const createdUser = await this.userModel.create(socialUser);
        console.log(createdUser);
      }
    } catch (e) {
      console.log(e);
    }
  }
}
