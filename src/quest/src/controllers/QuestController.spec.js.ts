import Web3 from "web3";
import {QuestProvider} from "../providers/QuestProvider";
import {QuestCacheProvider} from "../providers/QuestCacheProvider";
import {Clients} from "../providers/types";
import {BlockTransactionString} from "web3-eth";
import {WebsocketClient as TendermintWebsocketClient} from "@cosmjs/tendermint-rpc/build/rpcclients/websocketclient";
import {QuestController} from "./QuestController";
import {BlockchainNetworks} from "@workquest/database-models/lib/models";

const blocks: BlockTransactionString = {
  hash: '',
  parentHash: '',
  nonce: '',
  sha3Uncles: '',
  logsBloom: '',
  transactionRoot: '',
  stateRoot: '',
  receiptsRoot: '',
  miner: '',
  extraData: '',
  gasLimit: 1,
  gasUsed: 1,
  timestamp: '',
  number: 1,
  transactions: [],
  size: 1,
  difficulty: 1,
  totalDifficulty: 1,
  uncles: [],
}

const assignedEventData = {
  event: '',
  address: '',
  transactionHash: '',
  returnValues: { worker: '' },
}

jest.mock('web3', () => {
  return function () {
    return {
      eth: {
        getBlock: jest.fn(),
      }
    }
  }
});

describe('QuestController', () => {
  let questController: QuestController;

  let questProvider: QuestProvider;

  let web3: Web3;
  let questCacheProvider: QuestCacheProvider;
  let tendermintWsClient: TendermintWebsocketClient;

  let clients: Clients;

  beforeEach(() => {
    web3 = new Web3();
    tendermintWsClient = null;
    questCacheProvider = new QuestCacheProvider(null);

    clients = { web3, tendermintWsClient, questCacheProvider }

    questProvider = new QuestProvider(clients, null);

    questController = new QuestController(
      clients,
      questProvider,
      BlockchainNetworks.workQuestDevNetwork,
    );

    // TODO
    // questCacheProvider.set()
  });

  it('QuestController.assignedEventHandler', () => {
    (questProvider as any).onEventData(assignedEventData);
  });

});
