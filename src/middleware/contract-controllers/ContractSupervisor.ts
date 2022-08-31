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

  private tm = { i: 0, tm: [] };

  private runTaskBlockHeightSync() {
    console.log(this.tm.i, this.tm.tm);

    setTimeout(async () => {
      await this.controller.syncBlocks(() => {
        this.tm.i++;
        this.tm.tm.push(Date.now());

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
