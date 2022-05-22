import Web3 from "web3";
import { ethers } from 'ethers';
import BigNumber from "bignumber.js";
import { Logger } from "../logger/pino";
import { addJob } from "../../utils/scheduler";
import configSwapUsdt from "../config/config.swapUsdt";
import {
  Transaction,
  FirstWqtTransmissionData,
  TransmissionStatusFirstWqt,
} from "@workquest/database-models/lib/models";


export interface SendFirstWqtPayload {
  readonly ratio: number;
  readonly amount: string;
  readonly recipientAddress: string;
  readonly txHashSwapInitialized: string;
}

export async function sendFirstWqtJob(payload: SendFirstWqtPayload) {
  return addJob('sendFirstWqt', payload);
}

export default async function (payload: SendFirstWqtPayload) {
  try {
    const transmissionData = await FirstWqtTransmissionData.findOne({
      where: { txHashSwapInitialized: payload.txHashSwapInitialized }
    });

    if (!transmissionData) {
      Logger.warn('Job to send first wqt can`t find the swap, so it`s skipped, no match',
      );
      return;
    }
    if (transmissionData.status !== TransmissionStatusFirstWqt.Pending) {
      Logger.warn('Job to send first wqt can`t send transaction, because status not pending ',
      );
      return;
    }

    await transmissionData.update({ status: TransmissionStatusFirstWqt.InProcess });

    const faucetWallet = await ethers.utils.HDNode.fromMnemonic(configSwapUsdt.mnemonic).derivePath('m/44\'/60\'/0\'/0/0');
    const web3 = new Web3(new Web3.providers.HttpProvider(configSwapUsdt.workQuestDevNetwork.linkRpcProvider));
    const account = web3.eth.accounts.privateKeyToAccount(faucetWallet.privateKey);
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
      .toFixed()

    const transactionConfig = {
      gasPrice,
      gas: gasLimit,
      from: faucetWallet.address,
      to: payload.recipientAddress,
      value: amountValueToUserMinusPlatformFee,
    };

    await transmissionData.update({ gasPriceAtMoment: gasPrice });

    web3.eth.sendTransaction(transactionConfig)
      .then(async receipt => {
        const transaction = await Transaction.create({
          hash: receipt.transactionHash.toLowerCase(),
          to: receipt.to.toLowerCase(),
          from: receipt.from.toLowerCase(),
          status: receipt.status,
          gasUsed: receipt.gasUsed,
          amount: transactionConfig.value,
          blockNumber: receipt.blockNumber,
          network: configSwapUsdt.workQuestNetwork,
        });

        transmissionData.transactionHashTransmissionWqt = transaction.hash;

        if (!receipt.status) {
          transmissionData.status = TransmissionStatusFirstWqt.TransactionError;
        }

        await transaction.save();
      })
      .catch(async error => {
        await transmissionData.update({
          error: error.toString(),
          status: TransmissionStatusFirstWqt.BroadcastError,
        });
      })
  } catch (error) {
    await FirstWqtTransmissionData.update({
      error: error.toString(),
      status: TransmissionStatusFirstWqt.UnknownError,
    }, {
      where: {
        txHashSwapInitialized: payload.txHashSwapInitialized
      }
    });
  }
};
