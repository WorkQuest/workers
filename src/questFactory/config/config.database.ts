import {config} from "dotenv";

config({ path: __dirname +  '/../../../.env.questFactory'});

export default {
  dbLink: process.env.DB_LINK,
}

