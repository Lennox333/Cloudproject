

export const AWS_REGION = process.env.AWS_REGION || "ap-southeast-2";
export const BUCKET = process.env.S3_BUCKET || "n11772891-a2";
export const QUT_USERNAME = process.env.QUT_USERNAME || "n11772891";
export const PURPOSE = process.env.PURPOSE || "assignment";

export const USER_POOL_ID = process.env.COGNITO_USER_POOL_ID || "ap-southeast-2_UHY8axAL5";


export const AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID
export const AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY

export const COGNITO_CLIENT_ID = process.env.COGNITO_CLIENT_ID ||  "2pa4s4qiiseqdidl83vd2cnnq4";

export const COGNITO_CLIENT_SECRET = process.env.COGNITO_CLIENT_SECRET ||  "1gvvu02cb8ua5r924lgs9c1sk9guvdj1cf5crldurb4ks8iqg072";


// Table and key constants
export const DYNAMO_TABLE = `${QUT_USERNAME}-user_videos`;
export const USER_KEY = `${QUT_USERNAME}-user_id`; // Partition key
export const VIDEO_KEY = `${QUT_USERNAME}-video_id`; // Sort key
