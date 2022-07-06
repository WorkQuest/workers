import {IContractProvider, IController} from "../types";

export enum SupervisorContractTasks {
  None = 0,

  Heartbeat = 1 << 0,
  BlockHeightSync = 1 << 1,

  AllTasks = SupervisorContractTasks.BlockHeightSync | SupervisorContractTasks.Heartbeat,
}

export class SupervisorContract {
  protected readonly heartbeat = {
    state: {
      limit: null,
      timestamp: null,
    },
    options: {
      maxLimit: 3,
      period: 150000,
      maxBacklog: 30000,
    },
  };
  protected readonly blockHeightSync = {
    options: { period: 150000 },
  }

  constructor(
    protected readonly Logger: any,
    protected readonly controller: IController,
    protected readonly contractProvider: IContractProvider,
  ) {
  }

  private startHeartbeat() {
    this.heartbeat.state.limit = 0;
    this.heartbeat.state.timestamp = Date.now();

    this.Logger.debug('Supervisor Heartbeat (network: %s): Start heartbeat with timestamp "%s", options: %o',
      this.controller.network,
      this.heartbeat.state.timestamp,
      this.heartbeat.options,
    );

    setInterval(async () => {
      const isListening = await this.contractProvider.isListening();

      if (isListening) {
        this.heartbeat.state.timestamp = Date.now();

        this.Logger.info('Supervisor Heartbeat (network: %s): Updated timestamp "%s"',
          this.controller.network,
          this.heartbeat.state.timestamp,
        );
      } else {
        this.Logger.warn('Supervisor Heartbeat (network: %s): Provider is not responding',
          this.controller.network,
        );
      }
    }, this.heartbeat.options.period);
    setInterval(async () => {
      this.Logger.debug('Supervisor Heartbeat (network: %s): Current state before check: %o',
        this.controller.network,
        this.heartbeat.state,
      );

      if (Date.now() - this.heartbeat.state.timestamp > this.heartbeat.options.maxBacklog) {
        this.heartbeat.state.limit++;

        this.Logger.warn('Supervisor Heartbeat (network: %s): Missed heartbeat interval, limit of attempts will be increased',
          this.controller.network,
        );
      } else {
        this.heartbeat.state.limit = 0;
      }
      if (this.heartbeat.state.limit === this.heartbeat.options.maxLimit) {
        this.Logger.error('Supervisor Heartbeat (network: %s): Number of attempts has been exhausted, the worker will be restarted',
          this.controller.network,
        );

        process.exit(-1);
      }

      this.Logger.debug('Supervisor Heartbeat (network: %s): Current state after check: %o',
        this.controller.network,
        this.heartbeat.state,
      );
    }, this.heartbeat.options.period + 5000);
  }

  private startBlockHeightSync() {
    this.Logger.debug('Supervisor BlockHeightSync (network: %s): Start block height sync, options: %o',
      this.controller.network,
      this.heartbeat.options,
    );

    setInterval(async () => {
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
    }, this.blockHeightSync.options.period);
  }

  public async startTasks(includedTasks: SupervisorContractTasks = SupervisorContractTasks.AllTasks) {
    try {
      await this.controller.start();

      if ((includedTasks & SupervisorContractTasks.Heartbeat) != 0) {
        this.startHeartbeat();
      }
      if ((includedTasks & SupervisorContractTasks.BlockHeightSync) != 0) {
        this.startBlockHeightSync();
      }
    } catch (error) {
      this.Logger.error(error, 'Supervisor (network: %s): supervisor crash with unknown error',
        this.controller.network,
      );

      process.exit(-1);
    }
  }
}
