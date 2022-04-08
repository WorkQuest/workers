import {Op} from "sequelize";
import {Logger} from "../../logger/pino";
import { EventData } from 'web3-eth-contract';
import { IController, RaiseViewEvent } from './types';
import { RaiseViewClients, IContractProvider } from '../providers/types';
import { updateUserRaiseViewStatusJob } from "../../jobs/updateUserRaiseViewStatus";
import {
  Quest,
  QuestRaiseView,
  QuestRaiseStatus,
  RaiseViewBlockInfo,
  BlockchainNetworks,
  RaiseViewPromotedQuestEvent,
} from '@workquest/database-models/lib/models';

export class RaiseViewController implements IController {
  constructor(
    public readonly clients: RaiseViewClients,
    public readonly contractProvider: IContractProvider,
    public readonly network: BlockchainNetworks,
  ) {
    this.contractProvider.subscribeOnEvents(async (eventData) => {
      return this.onEvent(eventData);
    });
  }

  protected updateBlockViewHeight(blockHeight: number): Promise<any> {
    Logger.debug('Update blocks: new block height "%s"', blockHeight);

    return RaiseViewBlockInfo.update({ lastParsedBlock: blockHeight }, {
      where: {
        network: this.network,
        lastParsedBlock: { [Op.lt]: blockHeight },
      }
    });
  }

  private async onEvent(eventsData: EventData) {
    Logger.info('Event handler: name %s, block number %s, address %s',
      eventsData.event,
      eventsData.blockNumber,
      eventsData.address,
    );

    if (eventsData.event === RaiseViewEvent.Profile) {
      //await this.promotedUserEventHandler(eventsData);
    } else if (eventsData.event === RaiseViewEvent.Quest) {
      await this.promotedQuestEventHandler(eventsData);
    }
  }

  protected async promotedQuestEventHandler(eventsData: EventData) {
    const { timestamp } = await this.clients.web3.eth.getBlock(eventsData.blockNumber);

    const questContractAddress = eventsData.returnValues.quest.toLowerCase();

    const tariff = eventsData.returnValues.tariff;
    const period = eventsData.returnValues.period;
    const promotedAt = eventsData.returnValues.promotedAt;

    Logger.debug('Created event handler: timestamp "%s", event data o%',
      timestamp,
      eventsData,
    );

    const quest = await Quest.findOne({ where: { contractAddress: questContractAddress } });

    /** TODO тут нужно вначале делать findeOrCreate RaiseViewPromotedQuestEvent,
     * потом проверять isCreated (если уже создано кидать warn),
     * потом проверять quest (если не нашел кидать warn и обновлять блоки updateBlockViewHeight)
     * QuestRaiseView findeOrCreate на всякий
    **/
    if (!quest) {
      Logger.warn('Quest contract address is invalid', questContractAddress, eventsData);
      return;
    }

    const questRaiseView = await QuestRaiseView.findOne({ where: { questId: quest.id } });

    if (questRaiseView.status === QuestRaiseStatus.Paid) {
      Logger.warn('Quest raise view is still active', questContractAddress, eventsData);
    }

    const endedAt: Date = new Date(Date.now() + 86400000 * period);

    await questRaiseView.update({
      status: QuestRaiseStatus.Paid,
      duration: period,
      type: tariff,
      endedAt,
    });

    await RaiseViewPromotedQuestEvent.create({
      blockNumber: eventsData.blockNumber,
      transactionHash: eventsData.transactionHash,
      network: this.network,
      quest: questContractAddress,
      tariff,
      period,
      timestamp,
      promotedAt,
    });

    await this.updateBlockViewHeight(eventsData.blockNumber);

    await updateUserRaiseViewStatusJob({
      userId: quest.userId,
      runAt: endedAt,
    });
  }

  public async collectAllUncollectedEvents(fromBlockNumber: number) {
    Logger.info('Start collecting all uncollected events from block number: %s.', fromBlockNumber);

    const { collectedEvents, error } = await this.contractProvider.getAllEvents(fromBlockNumber);

    for (const event of collectedEvents) {
      try {
        await this.onEvent(event);
      } catch (error) {
        Logger.error(error, 'Event processing ended with error');

        throw error;
      }
    }

    if (error) {
      throw error;
    }
  }
}
