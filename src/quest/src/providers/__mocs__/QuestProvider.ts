import {Clients, IContractProvider, onEventCallBack} from "../types";
import {Contract, EventData} from "web3-eth-contract";

export class QuestProvider implements IContractProvider {

  private readonly onEventCallBacks: onEventCallBack[] = [];

  constructor(
    public readonly clients: Clients,
    public readonly contract: Contract,
  ) {
  }

  public async startListener() {

  }

  private async onEventData(eventData) {
    return Promise.all(
      this.onEventCallBacks.map(async callBack => callBack(eventData))
    );
  }

  public subscribeOnEvents(onEventCallBack: onEventCallBack) {
    this.onEventCallBacks.push(onEventCallBack);
  }

  public async getAllEvents(fromBlockNumber: number) {
    const collectedEvents: EventData[] = [];
    return { collectedEvents, isGotAllEvents: true, lastBlockNumber: 666 };
  }
}
