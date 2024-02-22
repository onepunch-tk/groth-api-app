import {
  IsBoolean,
  IsDate,
  IsOptional,
  IsString,
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';
import { IsDateRequiredDecorator } from '../../decorators/isDate-required.decorator';

export class PostDto {
  @IsString()
  username: string;

  @IsString()
  password: string;

  @IsBoolean()
  isMobile: boolean;

  @IsString()
  imgSrc: string;

  @IsOptional()
  @IsString()
  caption?: string;

  @IsBoolean()
  publishImmediately: boolean;

  @ValidateIf((o) => o.publishImmediately === false)
  @Type(() => Date)
  @IsDate()
  @IsDateRequiredDecorator('publishImmediately')
  scheduledPublishDate?: Date;
}
