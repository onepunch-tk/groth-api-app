import { ConfigService } from '@nestjs/config';
import path from 'path';

const PRODUCTION = 'production';
const DEVELOP = 'develop';

export const isProduction = (configService: ConfigService) =>
  configService.get<string>('NODE_ENV') === PRODUCTION;
export const getUserDataDir = (
  dirName: string,
  username: string,
  isProduction: boolean,
) => {
  return isProduction
    ? `--user-data-dir=${path.join(
        process.cwd(),
        'dist',
        `${dirName}-${username}-data-dir`,
      )}`
    : `--user-data-dir=${path.resolve(
        './src/__dev__',
        `${dirName}-${username}-data-dir`,
      )}`;
};
