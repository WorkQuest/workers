import Web3 from "web3";
import { ethers } from 'ethers';
import BigNumber from "bignumber.js";
import { Logger } from "../logger/pino";
import { addJob } from "../../utils/scheduler";
import configSwapUsdt from "../config/config.swapUsdt";
import { SwapUsdtSendWqt } from "@workquest/database-models/lib/models";


export interface SendFirstWqtPayload {
  readonly recipientWallet: string;
  readonly amount: BigNumber;
  readonly ratio: number;
  readonly txHashSwapInitialized: string;
}

export async function sendFirstWqtJob(payload: SendFirstWqtPayload) {
  return addJob('sendFirstWqt', payload);
}

export default async function (payload: SendFirstWqtPayload) {
  const sendWqt = await SwapUsdtSendWqt.findOne(
    {
      where: {
        txHashSwapInitialized: payload.txHashSwapInitialized.trim(),
        status: swapUsdtStatus.SwapCreated
      }
    }
  );

  if (!sendWqt) {
    Logger.warn('Job to send first wqt can`t find the swap, so it`s skipped, no match',
    );
    return;
  }

  await sendWqt.update({
    status: swapUsdtStatus.SwapProcessed
  });

  const faucetWallet = await ethers.utils.HDNode.fromMnemonic(configSwapUsdt.mnemonic).derivePath('m/44\'/60\'/0\'/0/0');

  const web3 = new Web3(new Web3.providers.HttpProvider(configSwapUsdt.workQuestDevNetwork.linkRpcProvider));

  const account = web3.eth.accounts.privateKeyToAccount(faucetWallet.privateKey);
  web3.eth.accounts.wallet.add(account);
  web3.eth.defaultAccount = account.address;

  const gasPrice = await web3.eth.getGasPrice();

  const amountValue = new BigNumber(payload.amount).shiftedBy(+18).toFixed(0)

  const txObject = {
    from: faucetWallet.address,
    gasPrice,
    to: payload.recipientWallet,
    value: amountValue.toString(),
  };

  const gasLimit = await web3.eth.estimateGas(txObject);

  const txFee = new BigNumber(amountValue).minus((Number(gasPrice) * gasLimit)).minus(new BigNumber(amountValue)
    .multipliedBy(payload.ratio).div(100)).shiftedBy(-18).toFixed(18);

  const sendWqtAmount = new BigNumber(txFee).toFormat({ decimalSeparator: '' }).toString();

  txObject['gas'] = gasLimit;
  txObject.value = sendWqtAmount;

  const sendTrans = await web3.eth.sendTransaction(txObject, async (error, hash) => {
    if (error) {
      await sendWqt.update({
        status: swapUsdtStatus.SwapError,
        statusMessage: error.message
      });
    }
  });

  await sendWqt.update({
    transactionHash: sendTrans.transactionHash,
    blockNumber: sendTrans.blockNumber,
    ratio: payload.ratio,
    amount: sendWqtAmount,
    status: swapUsdtStatus.SwapCompleted,
    gasUsed: sendTrans.gasUsed
  });
};
