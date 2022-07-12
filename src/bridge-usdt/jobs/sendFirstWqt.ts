import Web3 from "web3";
import BigNumber from "bignumber.js";
import { Logger } from "../logger/pino";
import { addJob } from "../utils/scheduler";
import configDatabase from "../config/config.common";
import configSwapUsdt from "../config/config.swapUsdt";
import { NotificationBroker } from "../../brokers/src/NotificationBroker";
import {
  Transaction,
  TransactionStatus,
  FirstWqtTransmissionData,
} from "@workquest/database-models/lib/models";

const notificationsBroker = new NotificationBroker(configDatabase.notificationMessageBroker.link, 'bridge_usdt');

export interface SendFirstWqtPayload {
  readonly ratio: number;
  readonly amount: string;
  readonly recipientAddress: string;
  readonly txHashSwapInitialized: string;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function sendFirstWqtJob(payload: SendFirstWqtPayload) {
  return addJob('sendFirstWqt', payload);
}

export default async function (payload: SendFirstWqtPayload) {
  try {
    await notificationsBroker.init();

    const transmissionData = await FirstWqtTransmissionData.findOne({
      where: { txHashSwapInitialized: payload.txHashSwapInitialized }
    });

    if (!transmissionData) {
      Logger.warn('Job to send first wqt can`t find the swap, so it`s skipped, no match',
      );
      return;
    }
    if (transmissionData.status !== TransactionStatus.Pending) {
      Logger.warn('Job to send first wqt can`t send transaction, because status not pending ',
      );
      return;
    }

    await transmissionData.update({ status: TransactionStatus.InProcess });

    const { linkRpcProvider } = configSwapUsdt.defaultWqConfigNetwork();

    const web3 = new Web3(new Web3.providers.HttpProvider(linkRpcProvider));
    const account = web3.eth.accounts.privateKeyToAccount(configSwapUsdt.accountSenderFirsWqt.privateKey);

    web3.eth.accounts.wallet.add(account);
    web3.eth.defaultAccount = account.address;

    const gasLimit = 21000;
    const gasPrice = parseInt(await web3.eth.getGasPrice());

    const amountValueToUser = new BigNumber(payload.amount);

    const platformCommissionWithTxFee = new BigNumber(gasLimit * gasPrice)
      .plus(
        amountValueToUser.multipliedBy(payload.ratio)
      )

    const amountValueToUserMinusPlatformFee = amountValueToUser
      .minus(platformCommissionWithTxFee)
      .toFixed(0)

    const transactionConfig = {
      gasPrice,
      gas: gasLimit,
      to: payload.recipientAddress,
      value: amountValueToUserMinusPlatformFee,
      from: configSwapUsdt.accountSenderFirsWqt.address,
    };

    await transmissionData.update({ gasPriceAtMoment: gasPrice });

    web3.eth.sendTransaction(transactionConfig)
      .then(async receipt => {
        const transaction = await Transaction.create({
          hash: receipt.transactionHash.toLowerCase(),
          to: receipt.to.toLowerCase(),
          from: receipt.from.toLowerCase(),
          status: receipt.status ? 0 : 1,
          gasUsed: receipt.gasUsed,
          amount: amountValueToUserMinusPlatformFee,
          blockNumber: receipt.blockNumber,
          network: configSwapUsdt.workQuestNetwork,
        });

        transmissionData.status = TransactionStatus.Success;
        transmissionData.transactionHashTransmissionWqt = transaction.hash;

        if (!receipt.status) {
          transmissionData.status = TransactionStatus.TransactionError;
        }

        await Promise.all([
          transaction.save(),
          transmissionData.save(),
        ]);

        await notificationsBroker.sendNotification({
          data: { ...(receipt.status && { hash: receipt.transactionHash.toLowerCase() }) },
          recipients: [payload.recipientAddress.toLowerCase()],
          action: 
            receipt.status
              ? 'TransactionSuccessful'
              : 'TransactionError'
        });
      })
      .catch(async error => {
        await transmissionData.update({
          error: error.toString(),
          status: TransactionStatus.BroadcastError,
        });

        await notificationsBroker.sendNotification({
          action: 'TransactionError',
          recipients: [payload.recipientAddress.toLowerCase()],
          data: {},
        });
      })

    await sleep(5000)
  } catch (err) {
    console.log(err)
    await FirstWqtTransmissionData.update({
      error: err.toString(),
      status: TransactionStatus.UnknownError,
    }, {
      where: {
        txHashSwapInitialized: payload.txHashSwapInitialized
      }
    });
    await sleep(5000)
  }
};
