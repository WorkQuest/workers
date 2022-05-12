import path from "path";
import fs from "fs";
import Web3 from "web3";
import { ethers } from 'ethers';
import configBridgeUSDT from "../config/config.bridgeUSDT";
import BigNumber from "bignumber.js";


const abiFilePath = path.join(__dirname, '../abi/WQToken.json');
const abi: any[] = JSON.parse(fs.readFileSync(abiFilePath).toString()).abi;

export interface sendFirstWqtPayload {
  recipientWallet: string;
  userId: string;
  network: string;
  amount: string;
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

  //TODO сначала нужно унать чему равна сумма USDT в WQT, потом уже добавлять запрашивать стоимость транзы!
  const txObject = {
    from: faucetWallet.address,
    gasPrice,
    to: configBridgeUSDT.wqtTokenContractAddress,
    value: '0x0',
    data: contract.methods.transfer(payload.recipientWallet, new BigNumber(payload.amount).shiftedBy(+12).toString()).encodeABI(),
    gas: null
  }
  const gasLimit = await web3.eth.estimateGas(txObject).then(value => {
    return value;
  });

  const txFee = parseInt(gasPrice) * gasLimit
  const sendAmount = new BigNumber(payload.amount).shiftedBy(+12) - txFee //TODO fix
  txObject.gas = gasLimit
  txObject.data = contract.methods.transfer(payload.recipientWallet,

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

  // await FaucetWusdWqt.create({
  //   userId: user.id,
  //   address: userWallet.wallet.address,
  //   amount: FaucetAmount.WQT,
  //   symbol: 'WQT',
  //   blockNumber: sendTrans.blockNumber,
  //   transactionHash: sendTrans.transactionHash,
  //   network: BlockchainNetworks.workQuestDevNetwork //TODO fix newtwork
  // });

  return ({
    txHash: sendTrans.transactionHash,
    status: sendTrans.status
  });
}
