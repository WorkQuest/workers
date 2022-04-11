import {config} from "dotenv";

config({ path: __dirname +  '/../../../.env.raiseView'});

export default {
  dbLink: process.env.DB_LINK,
  mqLink: process.env.RABBIT_LINK,
}

