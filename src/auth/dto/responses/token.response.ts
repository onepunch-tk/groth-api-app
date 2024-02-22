import { CommonResponse } from '../../../common/responses/common.response';

export interface TokenResponse extends CommonResponse {
  accessToken?: string;
}
