import Web3 from "web3";
import { ethers } from 'ethers';
import configBridgeUSDT from "../config/config.SwapUsdt";
import BigNumber from "bignumber.js";
import { addJob } from "../../utils/scheduler";
import { SwapUsdtSendWqt } from "@workquest/database-models/lib/models";
import { Logger } from "../logger/pino";
import { swapUsdtStatus } from "@workquest/database-models/lib/models/SwapUsdt/types";


export interface SendFirstWqtPayload {
  recipientWallet: string;
  amount: number;
  ratio: number;
  txHashSwapInitialized: string;
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
  )

  if (!sendWqt) {
    Logger.warn('Can`t find Swap initialized event handler: event "%s" (tx hash "%s") is skipped because the payment happened earlier',
    );
    return;
  }
  await sendWqt.update({
    status: swapUsdtStatus.SwapProcessed
  })

  const faucetWallet = await ethers.utils.HDNode.fromMnemonic(configBridgeUSDT.mnemonic).derivePath('m/44\'/60\'/0\'/0/0');

  const web3 = new Web3(new Web3.providers.HttpProvider('https://dev-node-ams3.workquest.co/'));

  const account = web3.eth.accounts.privateKeyToAccount(faucetWallet.privateKey);
  web3.eth.accounts.wallet.add(account);
  web3.eth.defaultAccount = account.address;

  const gasPrice = await web3.eth.getGasPrice();

  const nonce = await web3.eth.getTransactionCount(faucetWallet.address);

  const amountValue = new BigNumber(payload.amount).shiftedBy(+18).toFormat({ decimalSeparator: '' }).toString()

  const txObject = {
    from: faucetWallet.address,
    gasPrice,
    gas: undefined,
    to: payload.recipientWallet,
    value: amountValue,
    nonce: nonce
  }
  const gasLimit = await web3.eth.estimateGas(txObject)

  // @ts-ignore
  const txFee = (amountValue - (Number(gasPrice) * gasLimit)) - ((amountValue * payload.ratio) / 100)

  const sendWqtAmount = new BigNumber(txFee).toFormat({ decimalSeparator: '' }).toString()

  txObject.gas = gasLimit
  txObject.value = sendWqtAmount

  const sendTrans = await web3.eth.sendTransaction(txObject, async (error, hash) => {
    if (error) {
      await sendWqt.update({
        status: swapUsdtStatus.SwapError
      })
      return;
    }
  })
  await sendWqt.update({
    transactionHash: sendTrans.transactionHash,
    blockNumber: sendTrans.blockNumber,
    ratio: payload.ratio,
    amount: sendWqtAmount,
    status: swapUsdtStatus.SwapCreated,
    gasUsed: sendTrans.gasUsed
  })
}
