import Web3 from "web3";
import {Log} from "@ethersproject/abstract-provider/src.ts/index";
import {IBlockchainRepository, IIndexedKeysListRepository} from "./repository.interfaces";

export class BlockchainRepositoryWithCaching implements IBlockchainRepository {
  constructor(
    protected readonly web3: Web3,
    protected readonly logsRepository: IIndexedKeysListRepository<Log>,
  ) {
  }

  protected filterLogsByAddresses(logs: Log[], addresses: string[]): Log[] {
    return logs.filter(
      log =>
        addresses.findIndex(
          address => address.toLowerCase() === log.address.toLowerCase()
        ) !== -1
    )
  }

  protected async putLogsInRepository(logs: Log[], fromBlockNumber: number, toBlockNumber: number) {
    const lastBlockNumber =
      parseInt(
        (await this.logsRepository.getListKeysRangeByPosition(-1, -1))
          [0] || fromBlockNumber.toString()
      )

    const rangeLogsTable = new Map<number, Log[]>(
      Array
        .from({ length: toBlockNumber - lastBlockNumber + 1 },
          (_, i) =>
            [i + lastBlockNumber, []]
        )
    );

    logs
      .filter(
        log =>
          log.blockNumber >= lastBlockNumber
      )
      .forEach(
        log =>
          rangeLogsTable
            .get(log.blockNumber)
            .push(log)
      )

    if (
      lastBlockNumber < fromBlockNumber &&
      (fromBlockNumber - lastBlockNumber) !== 1
    ) {
      const uncollectedLogs = await this.getPastLogsFromNode({
        fromBlockNumber: lastBlockNumber +1,
        toBlockNumber: fromBlockNumber -1,
      }) as Log[];

      uncollectedLogs.forEach(
        log =>
          rangeLogsTable
            .get(log.blockNumber)
            .push(log)
      )
    }

    for (const [blockNumber, logs] of rangeLogsTable) {
      await this.logsRepository.push(blockNumber.toString(), ...logs);
    }
  }

  protected async getPastLogsFromRepository(payload: { addresses?: string[], fromBlockNumber: number, toBlockNumber: number }): Promise<Log[]> {
    const logs = await this.logsRepository.getValuesOfMergedListsRangeByScore(payload.fromBlockNumber, payload.toBlockNumber);

    return payload.addresses
      ? this.filterLogsByAddresses(logs, payload.addresses)
      : logs
  }

  protected async getPastLogsFromNode(payload: { addresses?: string[], fromBlockNumber: number, toBlockNumber: number }): Promise<Log[]> {
    const incrementStepsState = (state, steps) => {
      state.executionSteps.from = state.executionSteps.to + 1;

      state.blocksRange.to < state.executionSteps.to + steps
        ? state.executionSteps.to = state.blocksRange.to
        : state.executionSteps.to += steps
    }

    const logs = [];
    const steps = 2000;

    const state = {
      blocksRange: { from: payload.fromBlockNumber, to: payload.toBlockNumber },
      executionSteps: { from: payload.fromBlockNumber, to: payload.fromBlockNumber + steps },
    }

    if (payload.fromBlockNumber + steps > payload.toBlockNumber) {
      return await this.web3.eth.getPastLogs({
        address: payload.addresses,
        fromBlock: payload.fromBlockNumber,
        toBlock: payload.toBlockNumber,
      }) as Log[];
    }

    while (state.executionSteps.to < state.blocksRange.to) {
      let newLogs = await this.web3.eth.getPastLogs({
        address: payload.addresses,
        fromBlock: state.executionSteps.from,
        toBlock: state.executionSteps.to,
      }) as Log[];

      logs.push(...newLogs);
      incrementStepsState(state, steps);

      if (state.executionSteps.to === state.blocksRange.to) {
        newLogs = await this.web3.eth.getPastLogs({
          address: payload.addresses,
          fromBlock: state.executionSteps.from,
          toBlock: state.executionSteps.to,
        }) as Log[];

        logs.push(...newLogs);
      }
    }

    return logs;
  }

  public async getBlockNumber(): Promise<number> {
    return await this.web3.eth.getBlockNumber();
  }

  public async getPastLogs(payload: { addresses?: string[], fromBlockNumber: number, toBlockNumber: number }): Promise<Log[]> {
    if (payload.fromBlockNumber > payload.toBlockNumber) {
      throw new Error('"fromBlock must be less than or equal to toBlock"\n' +
        'fromBlockNumber: ' +  payload.fromBlockNumber + '\n' +
        'toBlockNumber: ' +  payload.toBlockNumber,
      );
    }

    const firstBlockNumber =
      parseInt(
        (await this.logsRepository.getListKeysRangeByPosition(0, 0))
          [0] || '-1'
      )
    const lastBlockNumber =
      parseInt(
        (await this.logsRepository.getListKeysRangeByPosition(-1, -1))
          [0] || '-1'
      )

    if (firstBlockNumber <= payload.fromBlockNumber && lastBlockNumber >= payload.toBlockNumber) {
      return await this.getPastLogsFromRepository(payload);
    }

    const logs = await this.getPastLogsFromNode({
      fromBlockNumber: payload.fromBlockNumber,
      toBlockNumber: payload.toBlockNumber,
    });

    await this.putLogsInRepository(logs, payload.fromBlockNumber, payload.toBlockNumber);

    return payload.addresses
      ? this.filterLogsByAddresses(logs, payload.addresses)
      : logs
  }
}
