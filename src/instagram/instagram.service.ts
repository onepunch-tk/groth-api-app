import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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

@Injectable()
export class InstagramService {
  private readonly logger = new Logger(InstagramService.name);
  constructor(
    @InjectModel(Post.name) private postModel: Model<Post>,
    private readonly configService: ConfigService,
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
  async getBrowser(username: string) {
    return createBrowser({
      commands: [
        '--disable-notifications',
        '--disable-web-security',
        '--lang=en',
        '--disable-setuid-sandbox',
        '--no-sandbox',
      ],
      configService: this.configService,
      dirName: 'insta',
      username,
      blockResources: [],
    });
  }

  async getPage(browser: Browser, isMobile: boolean) {
    return createPage(browser, isMobile);
  }
  async posting(scheduleId: Types.ObjectId) {
    this.logger.log('start posting');
    const INSTA_LOGIN_URL = 'https://instagram.com/accounts/login';
    const INSTA_URL = 'https://instagram.com/';
    let browser: Browser;
    let page: Page;
    try {
      const { username, password, isMobile, imgSrc, caption } =
        await this.postModel.findById(scheduleId);
      browser = await this.getBrowser(username);
      page = await this.getPage(browser, isMobile);
      await page.goto(INSTA_LOGIN_URL, { waitUntil: 'networkidle2' });

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

      await page.goto(INSTA_URL);
      this.logger.log('go home');
      await waitFor(2500);

      if (isMobile) {
        //dialog cancel btn
        this.logger.log('start mobile posting.');

        try {
          const cancelBtnEl = await page.waitForSelector(
            "xpath/.//button[contains(., 'Cancel')]",
            { timeout: 3000 },
          );
          await cancelBtnEl.click();
          await waitFor(2000);
        } catch (e) {
          this.logger.log('Not found Dialog');
        }

        await this.mobilePosting(page);
      } else {
        this.logger.log('start pc posting.');
        await this.pcPosting(page);
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
          await waitFor(1500);
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
        await waitFor(1500);
      }

      try {
        const shareBtnXpath =
          "xpath/.//button[contains(text(), 'Share')]|.//div[contains(text(), 'Share')]";
        const shareBtnEl = await page.waitForSelector(shareBtnXpath);
        await shareBtnEl.click();
        await waitFor(2000);
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
    } catch (e) {
      this.logger.error(e);
      page && (await page.close());
      browser && (await browser.close());
      await this.postModel.updateOne(
        { _id: scheduleId },
        { status: PostStatus.FAILURE },
      );
      return {
        statusCode: e.status,
      };
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

  private async mobilePosting(page: Page) {
    const homeElements = await page.$$('[aria-label=Home]');
    const postingMenuBtn = homeElements[homeElements.length - 1];
    await postingMenuBtn.click();
    await waitFor(1000);
    try {
      const [fileChooser] = await Promise.all([
        page.waitForFileChooser(),
        page.click("[aria-label='Post']"),
      ]);
      await fileChooser.accept(['src/__dev__/file1.jpeg']);
      this.logger.log('fileChooser Accepted');
      await waitFor(2500);
    } catch (error) {
      // The chrome version may not support file picker interaction
      this.logger.error(error);
      try {
        await page.click("[aria-label='Post']");
      } catch (err) {
        this.logger.error(error);
      }
    }
  }

  private async pcPosting(page: Page) {
    try {
      const createBtn = await page.waitForSelector('[aria-label^="New post"]');
      await createBtn.click();
      const inputEl = await page.waitForSelector('input[type=file]');
      await inputEl.uploadFile(
        'src/__dev__/file1.jpeg',
        'src/__dev__/file2.jpeg',
      );
      this.logger.log('upload images to input elements');
      await waitFor(2500);
    } catch (e) {
      this.logger.error(e);
    }
  }
}
