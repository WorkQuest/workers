import {IContractProvider, IController, ILogger} from "../interfaces";

export enum SupervisorContractTasks {
  None = 0,

  Heartbeat = 1 << 0,
  BlockHeightSync = 1 << 1,

  AllTasks = SupervisorContractTasks.BlockHeightSync | SupervisorContractTasks.Heartbeat,
}

export type BlockHeightSync = {
  period: number,
}

// TODO in middleware
export class SupervisorContract {
  protected blockHeightSync = {
    options: { period: 150000 },
  }

  constructor(
    protected readonly Logger: ILogger,
    protected readonly controller: IController,
    protected readonly contractProvider: IContractProvider,
  ) {
  }

  private async syncBlocks() {
    this.Logger.info('Supervisor BlockHeightSync (network: %s): Block height sync is started',
      this.controller.network,
    );

    try {
      await this.controller.syncBlocks();
    } catch (error) {
      this.Logger.error(error, 'Supervisor BlockHeightSync (network: %s): sync ended with an unknown error',
        this.controller.network,
      );

      process.exit(-1);
    }

    this.Logger.info('Supervisor BlockHeightSync (network: %s): Block height sync is completed',
      this.controller.network,
    );
  }

  private runTaskBlockHeightSync() {
    setTimeout(async () => {
      await this.syncBlocks();
      this.runTaskBlockHeightSync();
    }, this.blockHeightSync.options.period);
  }

  public setHeightSyncOptions(options: BlockHeightSync): this {
    this.blockHeightSync.options = options;

    return this;
  }

  public async startTasks(includedTasks: SupervisorContractTasks = SupervisorContractTasks.AllTasks) {
    await this.controller.start();

    if ((includedTasks & SupervisorContractTasks.BlockHeightSync) != 0) {
      this.runTaskBlockHeightSync();
    }
  }
}
