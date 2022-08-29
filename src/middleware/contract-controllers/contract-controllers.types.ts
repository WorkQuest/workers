
export enum SupervisorContractTasks {
  None = 0,

  Heartbeat = 1 << 0,
  BlockHeightSync = 1 << 1,

  AllTasks = SupervisorContractTasks.BlockHeightSync | SupervisorContractTasks.Heartbeat,
}

export type ContractSupervisorOptions = {
  blockHeightSync: { pollPeriod: number }
}
