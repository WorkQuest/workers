import Web3 from "web3";
import {Logger} from "./logger/pino";
import configFetcher from "./config/config.fetcher";
import {RouterMQServer} from "../middleware/message-oriented/RouterMQServer";
import {BlockchainNetworks} from "@workquest/database-models/lib/models";
import {BlockchainLogsServer} from "./src/BlockchainRouterServer";
import {
  TasksFactory,
  TasksExecutor,
  LogsFetcherWorker,
  EventLogsRedisRepository,
  BlockchainRepositoryWithCaching,
  BlockchainRepositoryWithCachingAddresses,
} from "../middleware";

async function wqInit() {
  const web3 = new Web3(new Web3.providers.HttpProvider('https://dev-node-fra1.workquest.co/'));

  const logsRedisRepo = await new EventLogsRedisRepository(
    'workQuestDevNetwork' as BlockchainNetworks,
    configFetcher.redis,
  )
    .on('error', (error) => {
      Logger.error(error, 'EventLogsRedisRepository stopped with error. Network: "%s"', configFetcher.network);
      process.exit(-1);
    })
    .init()

  const blockchainRepository = new BlockchainRepositoryWithCaching(
    web3,
    logsRedisRepo,
  );

  const tasksExecutor = new TasksExecutor({
    concurrency: 10,
    intervalInMs: 10000,
  });

  const tasksFactory = new TasksFactory(
    'workQuestDevNetwork' as BlockchainNetworks,
    blockchainRepository,
  );

  const logsFetcherWorker = new LogsFetcherWorker(blockchainRepository);

  const routerServer = await new RouterMQServer(
    configFetcher.routerServerMessageBrokerLink,
    'workQuestDevNetwork' as BlockchainNetworks,
  )
    .on('error', (error) => {
      Logger.error(error, 'RouterMQServer stopped with error. Network: "%s"', configFetcher.network);
      process.exit(-1);
    })
    .init()

  await new BlockchainLogsServer(
    routerServer,
    tasksFactory,
    tasksExecutor,
    logsFetcherWorker,
  )
    .start()
}

async function ethInit() {
  const web3 = new Web3(new Web3.providers.HttpProvider('https://speedy-nodes-nyc.moralis.io/a4b1a749a870bbd413acd4f0/eth/rinkeby'));

  const logsRedisRepo = await new EventLogsRedisRepository(
    BlockchainNetworks.rinkebyTestNetwork,
    configFetcher.redis,
  )
    .on('error', (error) => {
      Logger.error(error, 'EventLogsRedisRepository stopped with error. Network: "%s"', configFetcher.network);
      process.exit(-1);
    })
    .init()

  const blockchainRepository = new BlockchainRepositoryWithCachingAddresses(
    web3,
    ['0x03883AE9F07D71a1b67b89fD4af83B9A81e3f8C4'],
    logsRedisRepo,
  );

  const tasksExecutor = new TasksExecutor({
    concurrency: 10,
    intervalInMs: 10000,
  });

  const tasksFactory = new TasksFactory(
    BlockchainNetworks.rinkebyTestNetwork,
    blockchainRepository,
  );

  const logsFetcherWorker = new LogsFetcherWorker(blockchainRepository);

  const routerServer = await new RouterMQServer(
    configFetcher.routerServerMessageBrokerLink,
    BlockchainNetworks.rinkebyTestNetwork,
  )
    .on('error', (error) => {
      Logger.error(error, 'RouterMQServer stopped with error. Network: "%s"', configFetcher.network);
      process.exit(-1);
    })
    .init()

  await new BlockchainLogsServer(
    routerServer,
    tasksFactory,
    tasksExecutor,
    logsFetcherWorker,
  )
    .start()
}

async function bnbInit() {
  const web3 = new Web3(new Web3.providers.HttpProvider('https://speedy-nodes-nyc.moralis.io/a4b1a749a870bbd413acd4f0/bsc/testnet'));

  const logsRedisRepo = await new EventLogsRedisRepository(
    BlockchainNetworks.bscTestNetwork,
    configFetcher.redis,
  )
    .on('error', (error) => {
      Logger.error(error, 'EventLogsRedisRepository stopped with error. Network: "%s"', configFetcher.network);
      process.exit(-1);
    })
    .init()

  const blockchainRepository = new BlockchainRepositoryWithCachingAddresses(
    web3,
    ['0xd24ae80b2b1d6338d141979C223Ef6EBDD46dF01'],
    logsRedisRepo,
  );

  const tasksExecutor = new TasksExecutor({
    concurrency: 10,
    intervalInMs: 10000,
  });

  const tasksFactory = new TasksFactory(
    BlockchainNetworks.bscTestNetwork,
    blockchainRepository,
  );

  const logsFetcherWorker = new LogsFetcherWorker(blockchainRepository);

  const routerServer = await new RouterMQServer(
    configFetcher.routerServerMessageBrokerLink,
    BlockchainNetworks.bscTestNetwork,
  )
    .on('error', (error) => {
      Logger.error(error, 'RouterMQServer stopped with error. Network: "%s"', configFetcher.network);
      process.exit(-1);
    })
    .init()

  await new BlockchainLogsServer(
    routerServer,
    tasksFactory,
    tasksExecutor,
    logsFetcherWorker,
  )
    .start()
}

bnbInit().catch(error => {
  console.error(error);
  process.exit(-1);
});
ethInit().catch(error => {
  console.error(error);
  process.exit(-1);
});
wqInit().catch(error => {
  console.error(error);
  process.exit(-1);
});
