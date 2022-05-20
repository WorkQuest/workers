import Web3 from "web3";
import { ethers } from 'ethers';
import { Logger } from "../logger/pino";
import BigNumber from "bignumber.js";
import { addJob } from "../../utils/scheduler";
import configSwapUsdt from "../config/config.swapUsdt";
import {
  FirstWqtTransmissionData,
  TransmissionStatusFirstWqt
} from "@workquest/database-models/lib/models";
import {Transaction} from "@workquest/database-models/src/models/transaction-features/Transaction";

export interface SendFirstWqtPayload {
  readonly recipientWallet: string;
  readonly amount: string;
  readonly ratio: number;
  readonly txHashSwapInitialized: string;
}

export async function sendFirstWqtJob(payload: SendFirstWqtPayload) {
  return addJob('sendFirstWqt', payload);
}

export default async function (payload: SendFirstWqtPayload) {
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

  const gasPrice = await web3.eth.getGasPrice();

  const txObject = {
    from: faucetWallet.address,
    gasPrice,
    to: payload.recipientWallet,
    value: payload.amount.toString(),
  };

  const gasLimit = await web3.eth.estimateGas(txObject);

  const txFee = new BigNumber(payload.amount).minus((Number(gasPrice) * gasLimit)).minus(new BigNumber(payload.amount)
    .multipliedBy(payload.ratio).div(100)).shiftedBy(-18).toFixed(18);

  const sendWqtAmount = new BigNumber(txFee).toFormat({ decimalSeparator: '' }).toString();

  txObject['gas'] = gasLimit;
  txObject.value = sendWqtAmount;

  const sendTrans = await web3.eth.sendTransaction(txObject, async (error, hash) => {
    if (error) {
      await transmissionData.update({
        status: TransmissionStatusFirstWqt.TransactionError,
        error: error.message
      });
    }
  });

  await transmissionData.update({
    transactionHashTransmissionWqt: sendTrans.transactionHash,
    status: TransmissionStatusFirstWqt.Success
  });

  await Transaction.findOrCreate({
    where: { hash :sendTrans.transactionHash },
    defaults: {
      hash: sendTrans.transactionHash,
      // from: sendTrans.,
      // to: ,
      // blockNumber: ,
      // amount: ,
      // gasUsed: ,
      // network: ,
    }
  })
};
