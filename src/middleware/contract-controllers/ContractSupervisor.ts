import {ILogger} from "../logging/logging.interfaces";
import {IController} from "./contract-controllers.interfaces";
import {IContractProvider} from "../contract-providers/contract-providers.interfaces";
import {ContractSupervisorOptions, SupervisorContractTasks} from "./contract-controllers.types";

export class ContractSupervisor {
  constructor(
    protected readonly Logger: ILogger,
    protected readonly controller: IController,
    protected readonly options: ContractSupervisorOptions,
    protected readonly contractProvider: IContractProvider,
  ) {
  }

  private async syncBlocks() {
    this.Logger.info('Block height sync is started');

    try {
      await this.controller.syncBlocks();
    } catch (error) {
      this.Logger.error(error, 'Sync ended with an unknown error');

      process.exit(-1);
    }

    this.Logger.info('Block height sync is completed');
  }

  private runTaskBlockHeightSync() {
    setTimeout(async () => {
      await this.syncBlocks();
      this.runTaskBlockHeightSync();
    }, this.options.blockHeightSync.pollPeriod);
  }

  public async startTasks(includedTasks: SupervisorContractTasks = SupervisorContractTasks.AllTasks) {
    await this.controller.start();

    if ((includedTasks & SupervisorContractTasks.BlockHeightSync) != 0) {
      this.runTaskBlockHeightSync();
    }
  }
}
