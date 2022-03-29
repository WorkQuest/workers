import Web3 from "web3";
import * as sinon from 'sinon';
// import {QuestProvider} from "../providers/QuestProvider";
import {QuestCacheProvider} from "../providers/QuestCacheProvider";
import {QuestClients} from "../providers/types";
import {QuestController} from "./QuestController";
import {WebsocketClient as TendermintWebsocketClient} from "@cosmjs/tendermint-rpc/build/rpcclients/websocketclient";
import {
  BlockchainNetworks,
  Quest,
  User,
  UserRole,
  Wallet,
  QuestStatus,
  QuestAssignedEvent,
  QuestsResponse,
  QuestChat,
  QuestAssignedEventStatus,
} from "@workquest/database-models/lib/models";

const sandbox = sinon.createSandbox();

/** ----- New quest event -------- */
// assignedEventHandler
// assignedEventHandlerResult {
//   '0': '0x62a12aa058911d2571ef85da3e73ba68a3560006cad57f98af624f52fc8f8737',
//   '1': '111000000000000000000',
//   '2': '0',
//   '3': '0x7aebbb6555FC105326191844Fa73f11802faE619',
//   '4': '0x0000000000000000000000000000000000000000',
//   '5': '0xE24f99419d788003c0D5212f05F47B1572cDC38a',
//   '6': '1',
//   '7': '1678329322',
//   _jobHash: '0x62a12aa058911d2571ef85da3e73ba68a3560006cad57f98af624f52fc8f8737',
//   _cost: '111000000000000000000',
//   _forfeit: '0',
//   _employer: '0x7aebbb6555FC105326191844Fa73f11802faE619',
//   _worker: '0x0000000000000000000000000000000000000000',
//   _arbiter: '0xE24f99419d788003c0D5212f05F47B1572cDC38a',
//   _status: '1',
//   _deadline: '1678329322'
// }

// const createdQuestEvent = {
//     address: '0xF38E33e7DD7e1a91c772aF51A366cd126e4552BB',
//     blockNumber: 868377,
//     transactionHash: '0x8c3ff69d5d3316828dbeca940bd3304b1ead25f715bd268460809b4fa9a2680e',
//     transactionIndex: 0,
//     blockHash: '0x9f1d2b0eaad1513081a84a355bfe08c1501f7d78da632e49013211a2ea41b3f3',
//     logIndex: 2,
//     removed: false,
//     id: 'log_6c2d159d',
//     returnValues: Result {
//     '0': '0x62a12aa058911d2571ef85da3e73ba68a3560006cad57f98af624f52fc8f8737',
//     '1': '0x7aebbb6555FC105326191844Fa73f11802faE619',
//     '2': '0x2e21819C26E4FcbF2ba2985aD91BcEebb40f30BB',
//     '3': '1646824200',
//     '4': '240598',
//     jobHash: '0x62a12aa058911d2571ef85da3e73ba68a3560006cad57f98af624f52fc8f8737',
//     employer: '0x7aebbb6555FC105326191844Fa73f11802faE619',
//     workquest: '0x2e21819C26E4FcbF2ba2985aD91BcEebb40f30BB',
//     createdAt: '1646824200',
//     nonce: '240598'
//   },
//   event: 'WorkQuestCreated',
//   signature: '0xc9fd97c1118b97a71931dc93489f048cb2e4fb431adac7bce7756f6165eea68a',
//   raw: {
//   data: '0x62a12aa058911d2571ef85da3e73ba68a3560006cad57f98af624f52fc8f87370000000000000000000000007aebbb6555fc105326191844fa73f11802fae6190000000000000000000000002e21819c26e4fcbf2ba2985ad91bceebb40f30bb0000000000000000000000000000000000000000000000000000000062288b08000000000000000000000000000000000000000000000000000000000003abd6',
//     topics: [Array]
//   }
// };
/** --- */

const workerAddress = '0x8FB8de1eF01fFf50c220c91243148435556C4d8A';
const employerAddress = '0x7aebbb6555FC105326191844Fa73f11802faE619';
const questContractAddress = '0x2e21819C26E4FcbF2ba2985aD91BcEebb40f30BB';

const assignedEventData = {
  blockNumber: 868954,
  transactionHash: '0xe2a5f9e1bccf102ca6dbfa149da9c9e317642e426765f3970f583ec0b83fec14',
  blockHash: '0xeb92607e014c12aa320772105c9580590c9e468b0cfdffbf2579b5a1841043ed',
  blockTimestamp: 1646827372,

  event: {
    address: "0x2e21819C26E4FcbF2ba2985aD91BcEebb40f30BB",
    blockNumber: 868954,
    transactionHash: "0xe2a5f9e1bccf102ca6dbfa149da9c9e317642e426765f3970f583ec0b83fec14",
    transactionIndex: 1,
    blockHash: "0xeb92607e014c12aa320772105c9580590c9e468b0cfdffbf2579b5a1841043ed",
    logIndex: 0,
    removed: false,
    id: "log_708b63a3",
    returnValues: {
      0: "0x8FB8de1eF01fFf50c220c91243148435556C4d8A",
      worker: "0x8FB8de1eF01fFf50c220c91243148435556C4d8A"
    },
    event: "Assigned",
    signature: "0x3c8974307e4abad0239998f9dc76add6b783cd52bf1337e9871763ce00f0e94b",
    raw: {
      data: "0x0000000000000000000000008fb8de1ef01fff50c220c91243148435556c4d8a",
      topics: ["0x3c8974307e4abad0239998f9dc76add6b783cd52bf1337e9871763ce00f0e94b"]
    }
  },

  block: {
    baseFeePerGas: 7,
    difficulty: "0",
    extraData: "0x",
    gasLimit: 4294967295,
    gasUsed: 3450702,
    hash: "0xeb92607e014c12aa320772105c9580590c9e468b0cfdffbf2579b5a1841043ed",
    logsBloom: "0x00000000000000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000000000000000000008000000000000000000000000",
    miner: "0x8DaAF5F9B7ebBcee4CFc45E92FeD449843601532",
    mixHash: "0x0000000000000000000000000000000000000000000000000000000000000000",
    nonce: "0x0000000000000000",
    number: 868954,
    parentHash: "0x53e8c70a726798d4cf0ab88703b5c533d480dc1c5f82937aa5661268c8f8f35a",
    receiptsRoot: "0x56e81f171bcc55a6ff8345e692c0f86e5b48e01b996cadc001622fb5e363b421",
    sha3Uncles: "0x1dcc4de8dec75d7aab85b567b6ccd41ad312451b948a7413f0a142fd40d49347",
    size: 17375,
    stateRoot: "0x63b4117be4e1220ba19e22e9f13a7876f90f9f1a0b0b8ee3b400ad884a0a5cdc",
    timestamp: 1646827372,
    totalDifficulty: "0",
    transactions: ["0xe1360c1efbc5d173fd954b3cd5f5ffc0188605a37ba47cf8a43a5eaf2ca1e3c1","0xe2a5f9e1bccf102ca6dbfa149da9c9e317642e426765f3970f583ec0b83fec14"],
    transactionsRoot: "0xd256f14bace6bfc3160720198faed297f4dd1b9ed4b69b4869abe44715ef5e9c",
    uncles: []
  },
}


describe('QuestController', () => {
  let questController: QuestController;

  // let questProvider: QuestProvider;

  let web3: Web3;
  let questCacheProvider: QuestCacheProvider;
  let tendermintWsClient: TendermintWebsocketClient;

  let clients: QuestClients;

  beforeAll(() => {
    web3 = new Web3();
    tendermintWsClient = null;
    questCacheProvider = new QuestCacheProvider(null);

    clients = { web3, tendermintWsClient, questCacheProvider }

    // questProvider = new QuestProvider(clients, null);

    // questController = new QuestController(
    //   clients,
    //   questProvider,
    //   BlockchainNetworks.workQuestDevNetwork,
    // );

    // TODO
    // questCacheProvider.set()
  });

  afterEach(function () {
    sandbox.restore();
  });

  it('On event assigned. Quest status is Completed and event is already in database. Quest is given without changes', async () => {
    const workerUid = '00000000-0000-0000-0000-000000000001';

    const worker = {
      id: workerUid,
      role: UserRole.Worker,
      wallet: {
        userId: workerUid,
        address: workerAddress,
      },
    }

    const questUid = '00000000-0000-0000-0000-000000000002';

    const quest = {
      id: questUid,
      assignedWorkerId: workerUid,
      status: QuestStatus.Completed,
    }

    const questModelUpdateSpy = sandbox.spy(Quest, "update");
    const questsResponseModelUpdateSpy = sandbox.spy(QuestsResponse, "update");
    const questChatModelUpdateSpy = sandbox.spy(QuestChat, "update");

    sandbox.stub(User, "findOne").callsFake(async (options?: any) => {
      const { include } = options;

      expect(options).not.toBeNull();
      expect(include).not.toBeNull();

      if (Array.isArray(include)) {
        const { where } = (include as Array<any>).find(v => v.as === 'wallet');

        expect(where.address).toBe(workerAddress.toLowerCase());
      } else {
        const { where } = include as any;

        expect(where.address).toBe(workerAddress.toLowerCase());
      }

      return worker;
    });

    sandbox.stub(Quest, "findOne").callsFake(async (options?: any) => {
      const { where } = options;

      expect(options).not.toBeNull();
      expect(where).not.toBeNull();

      expect(where['contractAddress']).toBe(questContractAddress.toLowerCase());

      return quest;
    })

    sandbox.stub(web3.eth, "getBlock").callsFake(async (blockNumber) => {
      expect(parseInt(blockNumber)).toBe(assignedEventData.blockNumber);

      return assignedEventData.block;
    });

    sandbox.stub(QuestAssignedEvent, 'findOrCreate').callsFake(async (options: any) => {
      const { where, defaults } = options;

      expect(where).not.toBeNull();
      expect(defaults).not.toBeNull();

      expect(where['network']).toBe(defaults['network']);

      expect(where['network']).not.toBeNull(); /** Depends on env */
      expect(where['transactionHash']).toBe(assignedEventData.transactionHash.toLowerCase());

      expect(defaults['timestamp']).toBe(assignedEventData.block.timestamp);
      expect(defaults['workerAddress']).toBe(workerAddress.toLowerCase());
      expect(defaults['contractAddress']).toBe(questContractAddress.toLowerCase());
      expect(defaults['transactionHash']).toBe(assignedEventData.transactionHash.toLowerCase());
      expect(defaults['network']).not.toBeNull(); /** Depends on env */
      expect(defaults['status']).toBe(QuestAssignedEventStatus.Successfully);

      return [{ ...defaults, id: 1 }, false];
    });

    // await (questProvider as any).onEventData(assignedEventData.event);

    expect(questModelUpdateSpy.notCalled).toBe(true);
    expect(questsResponseModelUpdateSpy.notCalled).toBe(true);
    expect(questChatModelUpdateSpy.notCalled).toBe(true);
  });
  it('On event assigned. Quest status is Recruitment. Quest passed by status WaitingForConfirmFromWorkerOnAssign and new assigned worker', async () => {
    const workerUid = '00000000-0000-0000-0000-000000000001';

    const worker = {
      id: workerUid,
      role: UserRole.Worker,
      wallet: {
        userId: workerUid,
        address: workerAddress,
      },
    }

    const questUid = '00000000-0000-0000-0000-000000000002';

    const quest = {
      id: questUid,
      assignedWorkerId: workerUid,
      status: QuestStatus.Recruitment,
    }

    sandbox.stub(User, "findOne").callsFake(async (options?: any) => {
      if (!options) return null;

      if (options.include) {
        const include: any[] = Array.isArray(options.include) ?
          options.include : [options.include]

        const walletInclude = include.find(v => v.as === 'wallet');

        if (!walletInclude) {
          return null;
        }
        if (!walletInclude.require) {
          return null;
        }
        if (walletInclude.where.address === workerAddress.toLowerCase()) {
          return worker;
        }

        return null;
      }

      return null;
    });

    sandbox.stub(Quest, "findOne").callsFake(async (options?: any) => {
      if (!options) return null;
      if (options.where['contractAddress'] === questContractAddress.toLowerCase()) {
        return quest;
      }

      return null;
    })

    sandbox.stub(web3.eth, "getBlock").callsFake(async (blockNumber) => {
      if (parseInt(blockNumber) === blockNumber) {
        return assignedEventData.block;
      }
    });

    sandbox.stub(QuestAssignedEvent, 'findOrCreate').callsFake(async (options: any) => {
      const { where, defaults } = options;

      expect(where).not.toBeUndefined();
      expect(defaults).not.toBeUndefined();

      // expect(defaults['timestamp']).toBe()
      // expect(defaults['workerAddress']).toBe()
      // expect(defaults['contractAddress']).toBe()
      // expect(defaults['transactionHash']).toBe()
      // expect(defaults['network']).toBe()
      // expect(defaults['status']).toBe()


      return { ...defaults }
    });

  });
  it('On event assigned. Quest status is WaitingForConfirmFromWorkerOnAssign. Quest passed by status WaitingForConfirmFromWorkerOnAssign and new assigned worker', async () => {

  });
  it('On event assigned. Quest status is Completed. Quest is given without changes', async () => {

  });
  it('On event assigned. Quest is missing in the database. Event is not recorded in the database', async () => {

  });
  it('On event assigned. Assigned worker is missing in the database. Event is not recorded in the database', async () => {

  });



  // it('QuestController.JobStarted', () => {
  //   // questProvider.
  // });
  // it('QuestController.JobFinished', () => {
  //   // questProvider.
  // });

});
