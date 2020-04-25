// modules
import * as uuid from 'uuid';
export const uuidv1 = uuid.v1;

/**
 * Wrap this just so we can stub it in tests.
 *
 * Returns:
 *  String GUID of form uuid/v1 (see uuid npm package)
 **/
export function GetHowsMyDrivingId(): string {
  return uuidv1();
}

/*
export class MediaObject {
  constructor(string) {}

  url: string;
  alt_text: string;
  twitter_media_id_str: string;
}

export function MediaObjectsFromString(str: string): Array<MediaObject> {
  let media_objects: Array<MediaObject> = undefined;

  try {
    media_objects = JSON.parse(str) as Array<MediaObject>;
  } catch (err) {
    throw new Error(`Invalid media string '${str}': ${err}`);
  }

  return media_objects;
}
*/
