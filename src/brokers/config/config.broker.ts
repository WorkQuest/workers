import { config } from "dotenv";

config({ path: __dirname + '/../../../.env.broker' });

export default {
  mqLink: process.env.RABBIT_LINK,
}
