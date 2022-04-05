import { Logger } from "../../logger/pino";
import {IController, TrackedEvents} from "./types";
import { EventData } from "web3-eth-contract";
import {Clients, IContractProvider} from "../providers/types";
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
  constructor (
    public readonly clients: Clients,
    public readonly network: BlockchainNetworks,
    public readonly contractProvider: IContractProvider,
  ) {
    this.contractProvider.subscribeOnEvents(async (eventData) => {
      await this.onEvent(eventData);
    });
  }

  private async onEvent(eventsData: EventData) {
    Logger.info('Event handler: name %s, block number %s, address %s',
      eventsData.event,
      eventsData.blockNumber,
      eventsData.address,
    );

    if (eventsData.event === TrackedEvents.ProposalCreated) {
      return this.proposalCreatedEventHandler(eventsData);
    } else if (eventsData.event === TrackedEvents.VoteCast) {
      return this.voteCastEventHandler(eventsData);
    } else if (eventsData.event === TrackedEvents.ProposalExecuted) {
      return this.proposalExecutedEventHandler(eventsData);
    }
  }

  protected updateLastParseBlock(lastParsedBlock: number): Promise<void> {
    Logger.debug('Update blocks: new block height "%s"', lastParsedBlock);

    return void ProposalParseBlock.update(
      { lastParsedBlock },
      { where: { network: this.network } },
    );
  }

  protected async proposalCreatedEventHandler(eventsData: EventData) {
    const { timestamp } = await this.clients.web3.eth.getBlock(eventsData.blockNumber);

    const proposer = eventsData.returnValues.proposer.toLowerCase();
    const transactionHash = eventsData.transactionHash.toLowerCase();

    Logger.debug(
      'Proposal created event handler: timestamp "%s", event data o%',
      timestamp, eventsData
    );

    const proposal = await Proposal.findOne({
      where: { nonce: eventsData.returnValues.nonce },
    });

    const [_, isCreated] = await ProposalCreatedEvent.findOrCreate({
      where: {
        transactionHash,
        network: this.network,
      },
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
      Logger.warn('Proposal created event handler (event timestamp "%s"): event "%s" handling is skipped because it has already been created',
        timestamp,
        eventsData.event
      );

      return;
    }
    if (!proposal) {
      Logger.warn('Proposal created event handler (event timestamp "%s"): Proposal with nonce "%s" not found, event created, but proposal update skipped',
        timestamp,
        eventsData.returnValues.nonce
      );

      return this.updateLastParseBlock(eventsData.blockNumber);
    }

    const discussion = await Discussion.create({
      authorId: proposal.proposerUserId,
      title: proposal.title,
      description: proposal.description,
    });

    return Promise.all([
      discussion.$set('medias', proposal.medias), /** Duplicate medias  */
      this.updateLastParseBlock(eventsData.blockNumber),
      proposal.update({ discussionId: discussion.id, status: ProposalStatus.Active }),
    ]);
  }

  protected async voteCastEventHandler(eventsData: EventData) {
    const { timestamp } = await this.clients.web3.eth.getBlock(eventsData.blockNumber);

    const voter = eventsData.returnValues.voter.toLowerCase();
    const transactionHash = eventsData.transactionHash.toLowerCase();

    Logger.debug(
      'Proposal vote cast event handler: timestamp "%s", event data o%',
      timestamp, eventsData
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
      Logger.warn('Proposal vote cast event handler (event timestamp "%s"): event "%s" handling is skipped because it has already been created',
        timestamp,
        eventsData.event
      );

      return;
    }
    if (!proposalCreatedEvent) {

    }

    return this.updateLastParseBlock(eventsData.blockNumber);
  }

  protected async proposalExecutedEventHandler(eventsData: EventData) {
    const { timestamp } = await this.clients.web3.eth.getBlock(eventsData.blockNumber);

    const transactionHash = eventsData.transactionHash.toLowerCase();

    Logger.debug(
      'Proposal executed event handler: timestamp "%s", event data o%',
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
      Logger.warn('Proposal executed event handler (event timestamp "%s"): event "%s" handling is skipped because it has already been created',
        timestamp,
        eventsData.event
      );

      return;
    }
    if (!proposalCreatedEvent) {
      Logger.warn('Proposal executed event handler (event timestamp "%s"): proposal created event not found, event "%s" saved, but proposal was not updated',
        timestamp,
        eventsData.event
      );

      return this.updateLastParseBlock(eventsData.blockNumber);
    }

    const proposalStatus = executedEvent.succeeded
      ? ProposalStatus.Accepted
      : ProposalStatus.Rejected

    return Promise.all([
      this.updateLastParseBlock(eventsData.blockNumber),
      Proposal.update(
        { status: proposalStatus },
        { where: { id: executedEvent.proposalId } },
      ),
    ]);
  }

  public async collectAllUncollectedEvents(fromBlockNumber: number) {
    Logger.info('Start collecting all uncollected events from block number: %s.', fromBlockNumber);

    const { collectedEvents, isGotAllEvents, lastBlockNumber } = await this.contractProvider.getAllEvents(fromBlockNumber);

    for (const event of collectedEvents) {
      try {
        await this.onEvent(event);
      } catch (e) {
        Logger.error(e, 'Event processing ended with error');

        throw e;
      }
    }

    await ProposalParseBlock.update(
      { lastParsedBlock: lastBlockNumber },
      { where: { network: this.network } }
    );

    if (!isGotAllEvents) {
      throw new Error('Failed to process all events. Last processed block: ' + lastBlockNumber);
    }
  }
}
