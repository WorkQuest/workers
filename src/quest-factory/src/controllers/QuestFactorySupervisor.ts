import {IController, ISupervisor} from "./types";

export class QuestFactorySupervisor implements ISupervisor {
  constructor(
    public readonly controller: IController,
  ) {}


  public async scheduledInspections() {

  }

  public async blockHeightInspection() {

  }

  public eventsInspection(fromBlockNumber: number): Promise<void> {
    return this.controller.collectAllUncollectedEvents(fromBlockNumber);
  }
}
