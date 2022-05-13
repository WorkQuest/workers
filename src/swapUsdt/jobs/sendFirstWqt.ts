import path from "path";
import fs from "fs";
import Web3 from "web3";
import { ethers } from 'ethers';
import configBridgeUSDT from "../config/config.SwapUsdt";
import BigNumber from "bignumber.js";


const abiFilePath = path.join(__dirname, '../abi/WQToken.json');
const abi: any[] = JSON.parse(fs.readFileSync(abiFilePath).toString()).abi;

export interface sendFirstWqtPayload {
  recipientWallet: string;
  userId: string;
  network: string;
  amount: number;
  txSwap: string
}

export async function sendFirstWqt(payload: sendFirstWqtPayload) {
  const faucetWallet = await ethers.utils.HDNode.fromMnemonic(configBridgeUSDT.mnemonic).derivePath('m/44\'/60\'/0\'/0/0');

  const web3 = new Web3(new Web3.providers.HttpProvider('https://dev-node-ams3.workquest.co/'));

  const contract = new web3.eth.Contract(abi, configBridgeUSDT.wqtTokenContractAddress, { from: faucetWallet.address });

  const account = web3.eth.accounts.privateKeyToAccount(faucetWallet.privateKey);
  web3.eth.accounts.wallet.add(account);
  web3.eth.defaultAccount = account.address;

  const gasPrice = await web3.eth.getGasPrice().then(value => {
    return value;
  });

  const amountValue = new BigNumber(payload.amount).shiftedBy(+18).toFormat({ decimalSeparator: '' }).toString()

  const txObject = {
    from: faucetWallet.address,
    gasPrice,
    gas: undefined,
    to: configBridgeUSDT.wqtTokenContractAddress,
    value: '0x0',
    data: contract.methods.transfer(payload.recipientWallet, amountValue ).encodeABI()
  }
  const gasLimit = await web3.eth.estimateGas(txObject).then(value => { return value });

  //@ts-ignore
  const txFee = new BigNumber(amountValue).toFormat({ decimalSeparator: '' }) - (parseInt(gasPrice) * gasLimit)

  const sendWqtAmount = new BigNumber(txFee).toFormat({ decimalSeparator: '' }).toString()

  console.log(sendWqtAmount)
  txObject.gas = gasLimit

  // 1345.605253242908700000
  // 1345.605253242908300000

  //TODO нужно добавить в запрос конечное значение получаемых WQT и открыть ПР

  // txObject.data = contract.methods.transfer(payload.recipientWallet,

  // const sendTrans = await web3.eth.sendTransaction({
  //   from: faucetWallet.address,
  //   gasPrice,
  //   gas: configBridgeUSDT.gasLimitWqtTransfer, //216450
  //   to: configBridgeUSDT.wqtTokenContractAddress,
  //   value: '0x0',
  //   data: contract.methods.transfer(payload.recipientWallet, FaucetAmount.WQT).encodeABI()
  // }).then(response => {
  //   return response;
  // });
  //
  // await FaucetWusdWqt.create({
  //   userId: user.id,
  //   address: userWallet.wallet.address,
  //   amount: FaucetAmount.WQT,
  //   symbol: 'WQT',
  //   blockNumber: sendTrans.blockNumber,
  //   transactionHash: sendTrans.transactionHash,
  //   network: BlockchainNetworks.workQuestDevNetwork //TODO fix newtwork
  // });

  // return ({
  //   txHash: sendTrans.transactionHash,
  //   status: sendTrans.status
  // });
}
