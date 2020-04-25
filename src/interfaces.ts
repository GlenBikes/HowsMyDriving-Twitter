import { uuidv1 } from './util/stringutils';

export interface ITwitterUser {
  id?: number;
  id_str?: string;
  screen_name?: string;
}

export interface ITweet {
  id?: number;
  id_str?: string;
  text?: string;
  full_text?: string;
  user_screen_name?: string;
  in_reply_to_screen_name?: string;
  in_reply_to_status_id?: number;
  in_reply_to_status_id_str?: string;
  display_text_range?: Array<number>;
  user?: ITwitterUser;
}

export interface IGetTweetsResponse {
  tweets: Array<ITweet>;
  last_tweet_read_id: string;
}

export interface IImageDetails {
  image_type: string;
  w: number;
  h: number;
}

export interface IMediaUploadResponse {
  media_id: number;
  media_id_string: string;
  media_key: string;
  size: number;
  expires_after_secs: number;
  image: IImageDetails;
}
