import { ITweet } from 'howsmydriving-utils';

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
