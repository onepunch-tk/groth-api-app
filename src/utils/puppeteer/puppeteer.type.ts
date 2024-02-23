import { Permission, ResourceType } from 'puppeteer';
import { ConfigService } from '@nestjs/config';

type ChromiumCommandType =
  | '--disable-gpu'
  | '--disable-notifications'
  | '--start-maximized'
  | '--no-sandbox'
  | '--disable-setuid-sandbox'
  | '--disable-web-security'
  | '--disable-popup-blocking'
  | '--disable-accelerated-2d-canvas'
  | '--lang=en';
export type UserDataDirType = 'insta' | 'ytb' | 'coupang' | 'naver';

export type BrowserProps = {
  commands: ChromiumCommandType[];
  configService: ConfigService;
  dirPrefix?: UserDataDirType;
  username?: string;
  blockResources: ResourceType[];
  permission?: {
    origin: string;
    permissions: Permission[];
  };
};
