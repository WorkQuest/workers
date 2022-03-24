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
    console.log(eventsData.blockNumber);
    console.log(eventsData.event);
    if (eventsData.event === TrackedEvents.ProposalCreated) {
      return this.proposalCreatedEventHandler(eventsData);
    } else if (eventsData.event === TrackedEvents.VoteCast) {
      return this.voteCastEventHandler(eventsData);
    } else if (eventsData.event === TrackedEvents.ProposalExecuted) {
      return this.proposalExecutedEventHandler(eventsData);
    }
  }

  protected updateLastParseBlock(lastParsedBlock: number): Promise<void> {
    return void ProposalParseBlock.update(
      { lastParsedBlock },
      { where: { network: this.network } },
    );
  }

  protected async proposalCreatedEventHandler(eventsData: EventData) {
    const { timestamp } = await this.clients.web3.eth.getBlock(eventsData.blockNumber);

    const proposer = eventsData.returnValues.proposer.toLowerCase();
    const transactionHash = eventsData.transactionHash.toLowerCase();

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
      return;
    }
    if (!proposal) {
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
      return;
    }
    if (!proposalCreatedEvent) {

    }

    return this.updateLastParseBlock(eventsData.blockNumber);
  }

  protected async proposalExecutedEventHandler(eventsData: EventData) {
    const { timestamp } = await this.clients.web3.eth.getBlock(eventsData.blockNumber);

    const transactionHash = eventsData.transactionHash.toLowerCase();

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
      return;
    }
    if (!proposalCreatedEvent) {
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
    const { collectedEvents, isGotAllEvents, lastBlockNumber } = await this.contractProvider.getAllEvents(fromBlockNumber);

    for (const event of collectedEvents) {
      try {
        await this.onEvent(event);
      } catch (e) {
        console.error('Failed to process all events. Last processed block: ' + event.blockNumber);
        throw e;
      }
    }

    await ProposalParseBlock.update(
      { lastParsedBlock: lastBlockNumber },
      { where: { network: this.network } }
    );

    if (!isGotAllEvents) {
      throw new Error('Failed to process all events. Last processed block: ' + collectedEvents[collectedEvents.length - 1]);
    }
  }
}
