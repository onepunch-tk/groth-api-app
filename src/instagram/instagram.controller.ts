import { Body, Controller, Post, Res, UseGuards } from '@nestjs/common';
import { PostDto } from './dto/requests/post.dto';
import { InstagramService } from './instagram.service';
import { FastifyReply } from 'fastify';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SocialUser } from '../auth/decorators/social-user.decorator';
import { ISocialUser } from '../auth/interfaces/social-user.interface';

@Controller('instagram')
export class InstagramController {
  constructor(private readonly instagramService: InstagramService) {}

  @UseGuards(JwtAuthGuard)
  @Post('post-slot')
  async postSlot(
    @SocialUser() { id }: ISocialUser,
    @Body() postDto: PostDto,
    @Res() reply: FastifyReply,
  ) {
    const { statusCode, scheduleId } =
      await this.instagramService.createPostSchedule(postDto, id);
    reply.send({ statusCode, scheduleId });
    if (postDto.publishImmediately && scheduleId) {
      await this.instagramService.posting(scheduleId);
    }
  }
}
