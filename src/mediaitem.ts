export interface IMediaItem {
  url: string;
  alt_text: string;
  twitter_media_id_str: string;
}

export class MediaItem implements IMediaItem {
  constructor(media_item: IMediaItem) {
    this.url = media_item.url;
    this.alt_text = media_item.alt_text;
    this.twitter_media_id_str = media_item.twitter_media_id_str;
  }

  url: string;
  alt_text: string;
  twitter_media_id_str: string;
}

export function MediaItemsFromString(str: string): Array<IMediaItem> {
  let media_items: Array<MediaItem> = undefined;

  try {
    media_items = JSON.parse(str) as Array<IMediaItem>;
  } catch (err) {
    throw new Error(`Invalid media string '${str}': ${err}`);
  }

  return media_items;
}
