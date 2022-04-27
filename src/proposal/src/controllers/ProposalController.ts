import { Op } from "sequelize";
import { Logger } from "../../logger/pino";
import { EventData } from "web3-eth-contract";
import { IController, ProposalEvents } from "./types";
import { IContractProvider, ProposalClients } from "../providers/types";
import {
  Proposal,
  Discussion,
  ProposalStatus,
  ProposalParseBlock,
  BlockchainNetworks,
  ProposalCreatedEvent,
  ProposalExecutedEvent,
  ProposalVoteCastEvent,
} from "@workquest/database-models/lib/models";

export class ProposalController implements IController {
  constructor(
    public readonly clients: ProposalClients,
    public readonly network: BlockchainNetworks,
    public readonly contractProvider: IContractProvider,
  ) {
    this.contractProvider.subscribeOnEvents(async (eventData) => {
      await this.onEvent(eventData);
    });
  }

  private async onEvent(eventsData: EventData) {
    Logger.info('Event handler: name "%s", block number "%s", address "%s"',
      eventsData.event,
      eventsData.blockNumber,
      eventsData.address,
    );

    if (eventsData.event === ProposalEvents.ProposalCreated) {
      return this.proposalCreatedEventHandler(eventsData);
    } else if (eventsData.event === ProposalEvents.VoteCast) {
      return this.voteCastEventHandler(eventsData);
    } else if (eventsData.event === ProposalEvents.ProposalExecuted) {
      return this.proposalExecutedEventHandler(eventsData);
    }
  }

  protected updateBlockViewHeight(blockHeight: number) {
    Logger.debug('Update blocks: new block height "%s"', blockHeight);

    return ProposalParseBlock.update({ lastParsedBlock: blockHeight }, {
      where: {
        network: this.network,
        lastParsedBlock: { [Op.lt]: blockHeight },
      }
    });
  }

  protected async proposalCreatedEventHandler(eventsData: EventData) {
    const { timestamp } = await this.clients.web3.eth.getBlock(eventsData.blockNumber);

    const proposer = eventsData.returnValues.proposer.toLowerCase();
    const transactionHash = eventsData.transactionHash.toLowerCase();

    Logger.debug(
      'Proposal created event handler: timestamp "%s", event data %o',
      timestamp,
      eventsData,
    );

    const proposal = await Proposal.findOne({
      where: { nonce: eventsData.returnValues.nonce },
    });

    const [, isCreated] = await ProposalCreatedEvent.findOrCreate({
      where: { transactionHash, network: this.network },
      defaults: {
        proposer,
        timestamp,
        transactionHash,
        network: this.network,
        proposalId: proposal ? proposal.id : null,
        nonce: eventsData.returnValues.nonce,
        contractProposalId: eventsData.returnValues.id,
        description: eventsData.returnValues.description,
        votingPeriod: eventsData.returnValues.votingPeriod,
        minimumQuorum: eventsData.returnValues.minimumQuorum,
      }
    });

    if (!isCreated) {
      Logger.warn('Proposal created event handler: event "%s" (tx hash "%s") handling is skipped because it has already been created',
        transactionHash,
        eventsData.event,
      );

      return;
    }
    if (!proposal) {
      Logger.warn('Proposal created event handler: event "%s" (tx hash "%s") handling is skipped because proposal (nonce "%s") not found',
        eventsData.event,
        transactionHash,
        eventsData.returnValues.nonce,
      );

      return this.updateBlockViewHeight(eventsData.blockNumber);
    }

    Logger.debug('Proposal created event handler: event "%s" (tx hash "%s") found proposal (nonce "%s") %o',
      eventsData.event,
      transactionHash,
      eventsData.returnValues.nonce,
      proposal,
    );

    const discussion = await Discussion.create({
      authorId: proposal.proposerUserId,
      title: proposal.title,
      description: proposal.description,
    });

    Logger.debug('Proposal created event handler: event "%s" (tx hash "%s") discussion was created for proposal %o',
      eventsData.event,
      transactionHash,
      discussion,
    );

    await Promise.all([
      discussion.$set('medias', proposal.medias), /** Duplicate medias  */
      this.updateBlockViewHeight(eventsData.blockNumber),
      proposal.update({ discussionId: discussion.id, status: ProposalStatus.Active }),
    ]);


    await this.clients.notificationsBroker.sendNotification({
      recipients: [proposer],
      action: eventsData.event,
      data: eventsData,
    });
  }

  protected async voteCastEventHandler(eventsData: EventData) {
    const { timestamp } = await this.clients.web3.eth.getBlock(eventsData.blockNumber);

    const voter = eventsData.returnValues.voter.toLowerCase();
    const transactionHash = eventsData.transactionHash.toLowerCase();

    Logger.debug(
      'Proposal vote cast event handler: timestamp "%s", event data %o',
      timestamp,
      eventsData,
    );

    const proposalCreatedEvent = await ProposalCreatedEvent.findOne({
      where: { contractProposalId: eventsData.returnValues.proposalId },
    });

    const [_, isCreated] = await ProposalVoteCastEvent.findOrCreate({
      where: {
        transactionHash,
        network: this.network,
      },
      defaults: {
        voter,
        timestamp,
        transactionHash,
        network: this.network,
        proposalId: proposalCreatedEvent ? proposalCreatedEvent.proposalId : null,
        contractProposalId: eventsData.returnValues.id,
        support: eventsData.returnValues.support,
        votes: eventsData.returnValues.votes,
      }
    });

    if (!isCreated) {
      Logger.warn('Proposal vote cast event handler: event "%s" (tx hash "%s") handling is skipped because it has already been created',
        eventsData.event,
        transactionHash,
      );

      return;
    }
    if (!proposalCreatedEvent) {
      Logger.warn('Proposal vote cast event handler: event "%s" (tx hash "%s") handling is skipped because proposal created event not found',
        eventsData.event,
        transactionHash,
      );

      return this.updateBlockViewHeight(eventsData.blockNumber);
    }

    await this.clients.notificationsBroker.sendNotification({
      recipients: [proposalCreatedEvent.proposer],
      action: eventsData.event,
      data: eventsData,
    });

    return this.updateBlockViewHeight(eventsData.blockNumber);
  }

  protected async proposalExecutedEventHandler(eventsData: EventData) {
    const { timestamp } = await this.clients.web3.eth.getBlock(eventsData.blockNumber);

    const transactionHash = eventsData.transactionHash.toLowerCase();

    Logger.debug(
      'Proposal executed event handler: timestamp "%s", event data %o',
      timestamp, eventsData
    );

    const proposalCreatedEvent = await ProposalCreatedEvent.findOne({
      where: { contractProposalId: eventsData.returnValues.id },
    });

    const [executedEvent, isCreated] = await ProposalExecutedEvent.findOrCreate({
      where: {
        transactionHash,
        network: this.network,
      },
      defaults: {
        timestamp,
        transactionHash,
        network: this.network,
        proposalId: proposalCreatedEvent ? proposalCreatedEvent.proposalId : null,
        contractProposalId: eventsData.returnValues.id,
        succeded: eventsData.returnValues.succeded,
        defeated: eventsData.returnValues.defeated,
      }
    });

    if (!isCreated) {
      Logger.warn('Proposal executed event handler: event "%s" (tx hash "%s") handling is skipped because it has already been created',
        eventsData.event,
        transactionHash,
      );

      return;
    }
    if (!proposalCreatedEvent) {
      Logger.warn('Proposal vote cast event handler: event "%s" (tx hash "%s") handling is skipped because proposal created event not found',
        eventsData.event,
        transactionHash,
      );

      return this.updateBlockViewHeight(eventsData.blockNumber);
    }

    const proposalStatus = executedEvent.succeeded
      ? ProposalStatus.Accepted
      : ProposalStatus.Rejected

    await Promise.all([
      this.updateBlockViewHeight(eventsData.blockNumber),
      Proposal.update(
        { status: proposalStatus },
        { where: { id: executedEvent.proposalId } },
      ),
    ]);

    await this.clients.notificationsBroker.sendNotification({
      recipients: [proposalCreatedEvent.proposer],
      action: eventsData.event,
      data: eventsData
    });
  }

  public async collectAllUncollectedEvents(fromBlockNumber: number) {
    Logger.info('Start collecting all uncollected events from block number: %s.', fromBlockNumber);

    const { collectedEvents, error, lastBlockNumber } = await this.contractProvider.getAllEvents(fromBlockNumber);

    for (const event of collectedEvents) {
      try {
        await this.onEvent(event);
      } catch (e) {
        Logger.error(e, 'Event processing ended with error');

        throw e;
      }
    }

    await this.updateBlockViewHeight(lastBlockNumber);

    if (error) {
      throw error;
    }
  }
}
