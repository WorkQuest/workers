import { TrackedEvents } from "./types";
import { EventData } from "web3-eth-contract";
import { Web3Provider } from "../providers/types";
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

export class ProposalController {
  constructor (
    private readonly web3Provider: Web3Provider,
    private readonly network: BlockchainNetworks
  ) {
    this.web3Provider.subscribeOnEvents(async (eventData) => {
      await this.onEvent(eventData);
    });
  }

  private async onEvent(eventsData: EventData) {
    if (eventsData.event === TrackedEvents.ProposalCreated) {
      return this.proposalCreatedEventHandler(eventsData);
    } else if (eventsData.event === TrackedEvents.VoteCast) {
      return this.voteCastEventHandler(eventsData);
    } else if (eventsData.event === TrackedEvents.ProposalExecuted) {
      return this.proposalExecutedEventHandler(eventsData);
    }
  }

  protected async proposalCreatedEventHandler(eventsData: EventData) {
    const { timestamp } = await this.web3Provider.web3.eth.getBlock(eventsData.blockNumber);

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
        proposalId: proposal.id,
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

    const discussion = await Discussion.create({
      authorId: proposal.proposerUserId,
      title: proposal.title,
      description: proposal.description
    });

    /** Duplicate medias  */
    const discussionUpdateMediaPromise = discussion.$set('medias', proposal.medias);

    const proposalUpdatePromise = proposal.update({
      discussionId: discussion.id,
      status: ProposalStatus.Active,
    });

    const proposalUpdateBlockPromise = ProposalParseBlock.update(
      { lastParsedBlock: eventsData.blockNumber },
      { where: { network: this.network } },
    );

    return Promise.all([
      proposalUpdatePromise,
      proposalUpdateBlockPromise,
      discussionUpdateMediaPromise,
    ]);
  }

  protected async voteCastEventHandler(eventsData: EventData) {
    const { timestamp } = await this.web3Provider.web3.eth.getBlock(eventsData.blockNumber);

    const voter = eventsData.returnValues.voter.toLowerCase();
    const transactionHash = eventsData.transactionHash.toLowerCase();

    const { proposalId } = await ProposalCreatedEvent.findOne({
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
        proposalId,
        transactionHash,
        network: this.network,
        contractProposalId: eventsData.returnValues.id,
        support: eventsData.returnValues.support,
        votes: eventsData.returnValues.votes,
      }
    });

    if (!isCreated) {
      return;
    }

    return ProposalParseBlock.update(
      { lastParsedBlock: eventsData.blockNumber },
      { where: { network: this.network } },
    );
  }

  protected async proposalExecutedEventHandler(eventsData: EventData) {
    const { timestamp } = await this.web3Provider.web3.eth.getBlock(eventsData.blockNumber);

    const transactionHash = eventsData.transactionHash.toLowerCase();

    const { proposalId } = await ProposalExecutedEvent.findOne({
      where: { contractProposalId: eventsData.returnValues.id },
    });

    const [executedEvent, isCreated] = await ProposalExecutedEvent.findOrCreate({
      where: {
        transactionHash,
        network: this.network,
      },
      defaults: {
        timestamp,
        proposalId,
        transactionHash,
        network: this.network,
        contractProposalId: eventsData.returnValues.id,
        succeded: eventsData.returnValues.succeded,
        defeated: eventsData.returnValues.defeated,
      }
    });

    if (!isCreated) {
      return;
    }

    const proposalStatus = executedEvent.succeeded
      ? ProposalStatus.Accepted
      : ProposalStatus.Rejected

    return Promise.all([
      ProposalParseBlock.update(
        { lastParsedBlock: eventsData.blockNumber },
        { where: { network: this.network } },
      ),
      Proposal.update(
        { status: proposalStatus },
        { where: { proposalId: executedEvent.proposalId } },
      ),
    ]);
  }

  public async collectAllUncollectedEvents(fromBlockNumber: number) {
    const { collectedEvents, isGotAllEvents, lastBlockNumber } = await this.web3Provider.getAllEvents(fromBlockNumber);

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
