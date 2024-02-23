import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as AWS from 'aws-sdk';
import path from 'path';
import * as fs from 'fs/promises';
import { mkdir, readdir, readFile } from 'fs/promises';
import { getUserDataDirPath, isProduction } from '../utils';
import {
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { pipeline } from 'stream/promises';
import { createWriteStream } from 'fs';
import { Readable } from 'stream';

@Injectable()
export class S3Service {
  private s3: AWS.S3;
  private s3Client: S3Client;
  private bucketName: string;
  private logger = new Logger(S3Service.name);
  constructor(private readonly configService: ConfigService) {
    this.s3 = new AWS.S3({
      credentials: {
        accessKeyId: configService.get<string>('AWS_S3_ACCESS_KEY'),
        secretAccessKey: configService.get<string>('AWS_S3_SECRET_KEY'),
      },
      region: configService.get<string>('AWS_S3_REGION'),
    });

    this.s3Client = new S3Client({
      credentials: {
        accessKeyId: configService.get<string>('AWS_S3_ACCESS_KEY'),
        secretAccessKey: configService.get<string>('AWS_S3_SECRET_KEY'),
      },
      region: configService.get<string>('AWS_S3_REGION'),
    });
    this.bucketName = configService.get<string>('AWS_S3_BUCKET');
  }

  async downloadUserDataDir(
    dirPrefix: string,
    username: string,
  ): Promise<string> {
    const production = isProduction(this.configService);
    const localDir = getUserDataDirPath(dirPrefix, username, production);
    this.logger.log(`localDir: ${localDir}`);

    try {
      const prefix = `${username}-user-data-dir/`;
      const command = new ListObjectsV2Command({
        Bucket: this.configService.get('AWS_S3_BUCKET'),
        Prefix: prefix,
      });
      const { Contents } = await this.s3Client.send(command);

      for (const item of Contents) {
        const filePath = path.join(localDir, item.Key.substring(prefix.length));
        const fileDir = path.dirname(filePath);

        await mkdir(fileDir, { recursive: true });
        if (!item.Key.endsWith('/')) {
          const getObjectCommand = new GetObjectCommand({
            Bucket: this.configService.get('AWS_S3_BUCKET'),
            Key: item.Key,
          });
          const { Body } = await this.s3Client.send(getObjectCommand);

          if (Body instanceof Readable) {
            await pipeline(Body, createWriteStream(filePath)).catch((err) =>
              this.logger.error(`Error writing file: ${err}`),
            );
          } else {
            this.logger.error('Body is not a Readable stream');
            // 여기서 Blob 또는 다른 타입의 Body 처리 로직을 추가할 수 있습니다.
          }
        }
      }
    } catch (e) {
      this.logger.error(e);
    }

    return localDir;
  }

  async uploadUserDataDir(
    localDir: string,
    username: string,
    prefix: string = '',
  ): Promise<void> {
    try {
      const entries = await readdir(localDir, { withFileTypes: true });

      for (const entry of entries) {
        const localEntryPath = path.join(localDir, entry.name);
        const s3Key = prefix + entry.name;

        if (entry.isDirectory()) {
          const nestedPrefix = `${s3Key}/`;
          await this.uploadUserDataDir(localEntryPath, username, nestedPrefix);
        } else {
          const fileContent = await readFile(localEntryPath);
          const putObjectCommand = new PutObjectCommand({
            Bucket: this.configService.get('AWS_S3_BUCKET'),
            Key: `${username}-user-data-dir/${s3Key}`,
            Body: fileContent,
          });
          await this.s3Client.send(putObjectCommand);
        }
      }
    } catch (e) {
      this.logger.error(e);
    }
  }

  async deleteLocalUserDataDir(localDir: string): Promise<void> {
    try {
      await fs.rm(localDir, { recursive: true, force: true });
    } catch (e) {
      this.logger.error(e);
    }
  }
}
