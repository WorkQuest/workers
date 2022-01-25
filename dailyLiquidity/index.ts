import Web3 from 'web3';
import * as fs from 'fs';
import * as path from 'path';
import cron from 'node-cron';
import { Web3Helper } from './src/providers/Web3Helper';
import { DailyLiquidity } from '@workquest/database-models/lib/models';
import { ControllerDailyLiquidity } from './src/controllers/ControllerDailyLiquidity';
import { initDatabase } from '@workquest/database-models/lib/models';
import configDatabase from './config/config.database';
import configLiquidity from './config/config.liquidity';

const abiFilePath = path.join(__dirname, '/abi/WqtWbnb.json');
const abi: any[] = JSON.parse(fs.readFileSync(abiFilePath).toString()).abi;

export async function init() {
  await initDatabase(configDatabase.dbLink, true, true);

  const websocketProvider = new Web3.providers.WebsocketProvider(configLiquidity.wsProvider, {
    reconnect: {
      auto: true,
      delay: 10000,
      onTimeout: false,
    },
  });
  const web3 = new Web3(websocketProvider);
  const web3Helper = new Web3Helper(web3);

  const dailyLiquidityContract = new web3.eth.Contract(abi, configLiquidity.contractAddress);

  const poolController = new ControllerDailyLiquidity(web3Helper, dailyLiquidityContract);

  const liquidityDataPerPeriod = await poolController.collectLiquidityData(10);

  for (const liquidity of liquidityDataPerPeriod) {
    await DailyLiquidity.findOrCreate({
      where: { date: liquidity.date },
      defaults: liquidity,
    });
  }

  /** Every day at 12 AM */
  cron.schedule('0 0 * * *', async () => {
    const liquidityDataPerOneDay = await poolController.collectLiquidityData(1);
    for (const liquidity of liquidityDataPerOneDay) {
      await DailyLiquidity.findOrCreate({
        where: { date: liquidity.date },
        defaults: liquidity,
      });
    }
  });
}

init().catch(console.error);
