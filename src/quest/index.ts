import {QuestCacheProviderTest} from "./src/providers/QuestCacheProvider.test";
import {QuestProviderTest} from "./src/providers/QuestProvider.test";
import {QuestProvider} from "./src/providers/QuestProvider";
import {Clients} from "./src/providers/types";
import * as Jest from "@types/jest";

export async function initTest() {

  Jest.mock()

  const questCacheProvider = new QuestCacheProviderTest();
  // const

  // const clients: Clients = { };

  new QuestProviderTest()
}

export async function init() {
  const new

  new QuestProvider()

}
