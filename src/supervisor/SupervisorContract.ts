import {IContractProvider, IContractListenerProvider, IController, ILogger} from "../types";

export enum SupervisorContractTasks {
  None = 0,

  Heartbeat = 1 << 0,
  BlockHeightSync = 1 << 1,

  AllTasks = SupervisorContractTasks.BlockHeightSync | SupervisorContractTasks.Heartbeat,
}

export type HeartbeatOptions = {
  period: number,
  maxLimit: number,
  maxBacklog: number,
}

export type BlockHeightSync = {
  period: number,
}

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

  private startBlockHeightSync() {
    this.Logger.debug('Supervisor BlockHeightSync (network: %s): Start block height sync, options: %o',
      this.controller.network,
      this.blockHeightSync.options,
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

  public setHeightSyncOptions(options: BlockHeightSync): this {
    this.blockHeightSync.options = options;

    return this;
  }

  public async startTasks(includedTasks: SupervisorContractTasks = SupervisorContractTasks.AllTasks) {
    await this.controller.start();

    if ((includedTasks & SupervisorContractTasks.BlockHeightSync) != 0) {
      this.startBlockHeightSync();
    }
  }
}

export class SupervisorListenerContract extends SupervisorContract {
  protected heartbeat = {
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

  constructor(
    protected readonly Logger: ILogger,
    protected readonly controller: IController,
    protected readonly contractProvider: IContractListenerProvider,
  ) {
    super(Logger, controller, contractProvider);
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

  public setHeartbeatOptions(options: HeartbeatOptions): this {
    this.heartbeat.options = options;

    return this;
  }

  public async startTasks(includedTasks: SupervisorContractTasks = SupervisorContractTasks.AllTasks) {
    await super.startTasks();

    if ((includedTasks & SupervisorContractTasks.Heartbeat) != 0) {
      this.startHeartbeat();
    }
  }
}
