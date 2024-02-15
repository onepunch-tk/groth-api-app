export enum Social {
  KAKAO = 'KAKAO',
  GOOGLE = 'GOOGLE',
  NAVER = 'NAVER',
}

export enum Role {
  ADMIN = 'ADMIN',
  USER = 'USER',
}

export interface ISocialUser {
  username: string;
  password: string;
  nickname: string;
  social: Social;
}
