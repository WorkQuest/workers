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

  private runTaskBlockHeightSync() {
    setTimeout(async () => {
      await this.controller.syncBlocks(() => {
        this.runTaskBlockHeightSync();
      });
    }, this.options.blockHeightSync.pollPeriod);
  }

  public async startTasks(includedTasks: SupervisorContractTasks = SupervisorContractTasks.AllTasks) {
    await this.controller.start();

    if ((includedTasks & SupervisorContractTasks.BlockHeightSync) != 0) {
      this.runTaskBlockHeightSync();
    }
  }
}
