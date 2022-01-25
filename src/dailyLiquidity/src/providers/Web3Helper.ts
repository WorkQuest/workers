import Web3 from 'web3';
import EthDater from 'ethereum-block-by-date';

export type BlockData = {
  date: Date;
  block: number;
  timestamp: number;
};

export class Web3Helper {
  public readonly dater;
  constructor(public readonly web3: any) {
    this.web3 = web3;
    this.dater = new EthDater(web3);
  }

  /*  public async estimateBlockHeightByTimestamp(timestamp: number, pre: number = 1, post: number | 'latest' = 'latest'): Promise<number> {
    const firstBlock = await this.web3.eth.getBlock(pre);
    const latestBlock = await this.web3.eth.getBlock(post);

    const firstBlockNumber = firstBlock.number;
    const latestBlockNumber = latestBlock.number;

    if (firstBlockNumber === latestBlockNumber) return pre;
    if (post !== 'latest' && Math.abs(pre - post) === 1) return pre;

    const firstBlockTimestamp = parseInt(firstBlock.timestamp as string);
    const latestBlockTimestamp = parseInt(latestBlock.timestamp as string);

    const deltaBlock = latestBlockNumber - firstBlockNumber;
    const deltaTimestamp = latestBlockTimestamp - firstBlockTimestamp;

    const avBlockTime = deltaTimestamp / deltaBlock;
    const k = (timestamp - firstBlockTimestamp) / deltaTimestamp;

    const blockNumberExpected = Math.trunc(firstBlockNumber + k * deltaBlock);
    const blockExpected = await this.web3.eth.getBlock(blockNumberExpected);
    const blockTimestampExpected = parseInt(blockExpected.timestamp as string);

    const targetTimestamp = (timestamp - blockTimestampExpected) / avBlockTime;
    const expectedA = blockNumberExpected + targetTimestamp;

    const r = Math.abs(targetTimestamp);

    return this.estimateBlockHeightByTimestamp(
      timestamp,
      Math.trunc(expectedA - r),
      Math.trunc(expectedA + r)
    );
  }*/

  public async getBlockByDate(date: Date, after = false): Promise<BlockData> {
    // @ts-ignore
    return this.dater.getDate(date, after);
  }
}
