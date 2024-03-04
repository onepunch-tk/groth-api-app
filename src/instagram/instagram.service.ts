import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import puppeteer from 'puppeteer-extra';

import {
  createBrowser,
  createPage,
  isSignedForInstagram,
  waitFor,
} from '../utils/puppeteer';
import { PostDto } from './dto/requests/post.dto';
import { Browser, Page } from 'puppeteer';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Post } from './schemas/post.schema';
import { PostStatus } from './interfaces/post.interface';
import { S3Service } from '../s3/s3.service';
import { UserDataDirType } from 'src/utils/puppeteer/puppeteer.type';
import { randomInt } from 'crypto';
import sharp from 'sharp';
import axios from 'axios';

@Injectable()
export class InstagramService {
  private readonly logger = new Logger(InstagramService.name);
  constructor(
    @InjectModel(Post.name) private postModel: Model<Post>,
    private readonly configService: ConfigService,
    private readonly s3Service: S3Service,
  ) {}

  async createPostSchedule(postDto: PostDto, requester: Types.ObjectId) {
    try {
      const schedule = await this.postModel.create({
        ...postDto,
        requester: new Types.ObjectId(requester),
      });
      return {
        statusCode: HttpStatus.OK,
        scheduleId: schedule.id,
      };
    } catch (e) {
      return {
        statusCode: HttpStatus.FORBIDDEN,
        scheduleId: undefined,
      };
    }
  }
  private async getBrowser(dirName: UserDataDirType, username: string) {
    return createBrowser({
      commands: [
        '--disable-notifications',
        '--disable-web-security',
        '--lang=en',
        '--disable-setuid-sandbox',
        '--no-sandbox',
      ],
      configService: this.configService,
      dirPrefix: dirName,
      username,
      blockResources: [],
    });
  }

  private async getPage(browser: Browser, isMobile: boolean) {
    return createPage(browser, isMobile);
  }
  async posting(scheduleId: Types.ObjectId) {
    this.logger.log('start posting');
    const INSTA_LOGIN_URL = 'https://instagram.com/accounts/login';
    const INSTA_URL = 'https://instagram.com/';
    let browser: Browser;
    let page: Page;
    let localDir: string;

    try {
      const { username, password, isMobile, imgSrc, caption } =
        await this.postModel.findById(scheduleId);

      //aws s3 유저 데이터 directory 다운로드
      localDir = await this.s3Service.downloadUserDataDir('insta', username);

      //browser 및 page 생성
      browser = await this.getBrowser('insta', username);
      page = await this.getPage(browser, isMobile);

      await page.goto(INSTA_LOGIN_URL, { waitUntil: 'networkidle2' });

      //login form이 있을 경우 로그인 시도.
      if (await isSignedForInstagram(page)) {
        this.logger.log('need sign in.');
        const { statusCode, authenticated } = await this.signInByAccount(
          { username, password },
          page,
        );
        if (!authenticated) {
          await page.close();
          await browser.close();
          this.logger.error('Unauthorized from instagram');
          await this.postModel.updateOne(
            { _id: scheduleId },
            { status: PostStatus.UNAUTHORIZED },
          );
          return {
            statusCode,
            message: 'Bad Request',
          };
        }
      }

      //인스타그램 홈으로 이동
      await page.goto(INSTA_URL);
      this.logger.log('go home');
      await waitFor(2500);

      //사용자 동의 dialog 창이 뜨면, 사용자 동의
      try {
        await page.waitForSelector(
          'xpath/.//span[contains(text(), "I agree")]',
          { timeout: 2000 },
        );
        const inputSwitchList = await page.$$('input[role=switch]');
        if (inputSwitchList.length > 0) {
          for (const inputEl of inputSwitchList) {
            await inputEl.click();
            await waitFor(100);
          }
        }
        await waitFor(100);
        await page.click("div[aria-label^='I agree']");
        await waitFor(100);
        await page.click("div[aria-label^='Close']");
        await waitFor(100);
      } catch (e) {
        this.logger.error(e);
      }

      if (isMobile) {
        this.logger.log('start mobile posting.');
        try {
          const cancelBtnEl = await page.waitForSelector(
            "xpath/.//button[contains(., 'Cancel')]",
            { timeout: 3000 },
          );
          await cancelBtnEl.click();
          await waitFor(200);
        } catch (e) {
          this.logger.log('Not found Dialog');
        }
        await this.mobilePosting(page, [imgSrc]);
      } else {
        this.logger.log('start pc posting.');
        await this.pcPosting(page, [imgSrc]);
      }

      const nextBtnXpath =
        "xpath/.//button[contains(text(), 'Next')]|.//div[contains(text(), 'Next')]";
      let postingWorker = true;
      while (postingWorker) {
        try {
          const nextBtnEl = await page.waitForSelector(nextBtnXpath, {
            timeout: 2000,
          });
          await nextBtnEl.click();
          await waitFor(200);
        } catch (e) {
          postingWorker = false;
        }
      }

      if (caption) {
        if (isMobile) {
          await page.type('textarea', caption, { delay: 50 });
        } else {
          const inputEl = await page.waitForSelector(
            '[aria-label^="Write a caption"]',
          );
          await inputEl.type(caption, { delay: 50 });
        }
        await waitFor(150);
      }

      try {
        const shareBtnXpath =
          "xpath/.//button[contains(text(), 'Share')]|.//div[contains(text(), 'Share')]";
        const shareBtnEl = await page.waitForSelector(shareBtnXpath);
        await shareBtnEl.click();
        await waitFor(200);
        this.logger.log('posting success.');
      } catch (e) {
        await this.postModel.updateOne(
          { _id: scheduleId },
          { status: PostStatus.FAILURE },
        );
        this.logger.error('posting Failed');
      }

      await page.close();
      await browser.close();

      await this.postModel.updateOne(
        { _id: scheduleId },
        { status: PostStatus.SUCCESS },
      );
      //작업이 완료되면 user data upload
      await this.s3Service.uploadUserDataDir(localDir, username);
    } catch (e) {
      this.logger.error(e);
      page && (await page.close());
      browser && (await browser.close());
      await this.postModel.updateOne(
        { _id: scheduleId },
        { status: PostStatus.FAILURE },
      );
    } finally {
      if (localDir) {
        await this.s3Service.deleteLocalUserDataDir(localDir);
      }
    }
  }
  async signInByAccount(
    { username, password }: { username: string; password: string },
    page: Page,
  ) {
    try {
      await page.type("input[name='username']", username, { delay: 50 });
      await page.type("input[name='password']", password, { delay: 50 });
      await waitFor(2000);
      await page.click("button[type='submit']");

      const finalResponse = await page.waitForResponse(async (res) => {
        return (
          res.url() ===
            'https://www.instagram.com/api/v1/web/accounts/login/ajax/' &&
          res.status() === 200
        );
      });
      const { authenticated } = await finalResponse.json();
      return {
        statusCode: authenticated ? HttpStatus.OK : HttpStatus.BAD_REQUEST,
        authenticated,
      };
    } catch (e) {
      return {
        statusCode: HttpStatus.BAD_REQUEST,
        authenticated: false,
      };
    }
  }

  private async mobilePosting(page: Page, imgSrc: string[]) {
    const homeElements = await page.$$('[aria-label=Home]');
    const postingMenuBtn = homeElements[homeElements.length - 1];
    await postingMenuBtn.click();
    await waitFor(200);
    try {
      const [fileChooser] = await Promise.all([
        page.waitForFileChooser(),
        page.click("[aria-label='Post']"),
      ]);
      await fileChooser.accept(imgSrc);
      this.logger.log('fileChooser Accepted');
      await waitFor(250);
    } catch (error) {
      // The chrome version may not support file picker interaction
      this.logger.error(error);
    }
  }

  private async pcPosting(page: Page, imgSrc: string[]) {
    try {
      const createBtn = await page.waitForSelector('[aria-label^="New post"]');
      await createBtn.click();
      const inputEl = await page.waitForSelector('input[type=file]');
      await inputEl.uploadFile(...imgSrc);
      this.logger.log('upload images to input elements');
      await waitFor(250);
    } catch (e) {
      this.logger.error(e);
    }
  }

  async createPostImg() {
    let browser: Browser;
    let page: Page;
    try {
      const UN_SPLASH_URL = 'https://unsplash.com';
      browser = await puppeteer.launch({ headless: false });
      page = await browser.newPage();
      await page.goto(UN_SPLASH_URL);
      // `href` 속성이 "/t/"로 시작하는 모든 `a` 태그의 `href` 값을 배열로 수집합니다.
      const hrefValues = await page.$$eval('a[href^="/t/"]', (anchors) =>
        anchors.map((anchor) => anchor.getAttribute('href')),
      );
      // hrefValues 배열의 길이를 확인하고, 0부터 길이 - 1까지의 랜덤 인덱스를 생성합니다.
      const randomIndex = Math.floor(Math.random() * hrefValues.length);
      await page.goto(UN_SPLASH_URL + hrefValues[randomIndex]);

      // src 속성을 가져옵니다 (실제 셀렉터로 교체해야 함)
      const imgSrc = await page.$eval('img[srcset]', (img) => img.src);
      const response = await axios.get(imgSrc, { responseType: 'arraybuffer' });
      const originalImage: ArrayBuffer = response.data;

      await page.close();
      await browser.close();

      return await this.resizeImageForInstagram(originalImage);
    } catch (e) {
      page && (await page.close());
      browser && (await browser.close());
      return '';
    }
  }

  private async resizeImageForInstagram(originalImage: ArrayBuffer) {
    const outputPath = 'src/__dev__/image.jpg';
    // 1~5px 사이의 랜덤 값을 생성
    const cropWidth = randomInt(1, 6);
    const cropHeight = randomInt(1, 6);

    // 밝기와 채도를 0.9~1.2 사이의 랜덤 값으로 설정
    const brightness = Math.random() * (1.2 - 0.9) + 0.9;
    const saturation = Math.random() * (1.2 - 0.9) + 0.9;

    const image = sharp(originalImage)
      .resize({
        width: 1080,
        height: 1350,
        fit: 'cover', // 중요한 부분이 잘리지 않도록 조정
      })
      // 랜덤하게 잘라낸 값을 적용하여 이미지를 잘라냄
      .extract({
        left: cropWidth,
        top: cropHeight,
        width: 1080 - cropWidth,
        height: 1350 - cropHeight,
      })
      // 밝기와 채도를 조정
      .modulate({
        brightness: brightness,
        saturation: saturation,
      });

    // 조정된 이미지를 파일로 저장
    await image.toFile(outputPath);
    return outputPath;
  }
}
