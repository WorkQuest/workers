import { TrackedEvents } from "./types";
import { EventData } from "web3-eth-contract";
import { Web3Provider } from "../providers/types";
import { ProposalStatus } from '@workquest/database-models/lib/models/proposal/types';
import {
  Proposal,
  Discussion,
  ProposalParseBlock,
  BlockchainNetworks,
  ProposalCreatedEvent,
  ProposalExecutedEvent,
  ProposalVoteCastEvent
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
      await this.proposalCreatedEventHandler(eventsData);
    } else if (eventsData.event === TrackedEvents.VoteCast) {
      await this.voteCastEventHandler(eventsData);
    } else if (eventsData.event === TrackedEvents.ProposalExecuted) {
      await this.proposalExecutedEventHandler(eventsData);
    }
  }

  protected async proposalCreatedEventHandler(eventsData: EventData) {
    const block = await this.web3Provider.web3.eth.getBlock(eventsData.blockNumber);

    const proposal = await Proposal.findOne({
      where: {
        proposer: eventsData.returnValues.proposer.toLowerCase(),
        nonce: eventsData.returnValues.nonce
      }
    });

    const [_, isCreated] = await ProposalCreatedEvent.findOrCreate({
      where: {
        transactionHash: eventsData.transactionHash,
        network: this.network,
      },
      defaults: {
        proposalId: proposal.id,
        network: this.network,
        transactionHash: eventsData.transactionHash,
        contractProposalId: eventsData.returnValues.id,
        proposer: eventsData.returnValues.proposer.toLowerCase(),
        nonce: eventsData.returnValues.nonce,
        description: eventsData.returnValues.description,
        votingPeriod: eventsData.returnValues.votingPeriod,
        minimumQuorum: eventsData.returnValues.minimumQuorum,
        timestamp: block.timestamp,
      }
    });

    if (isCreated) {
      const discussion = await Discussion.create({
        authorId: proposal.userId,
        title: proposal.title,
        description: proposal.description
      });

      await discussion.$set('medias', proposal.medias);

      await proposal.update({
        discussionId: discussion.id,
        status: ProposalStatus.Active,
      });
    }

    await ProposalParseBlock.update(
      { lastParsedBlock: eventsData.blockNumber },
      { where: { network: this.network } }
    );
  }

  protected async voteCastEventHandler(eventsData: EventData) {
    const block = await this.web3Provider.web3.eth.getBlock(eventsData.blockNumber);

    const { proposalId } = await ProposalCreatedEvent.findOne({
      where: { contractProposalId: eventsData.returnValues.proposalId }
    });

    await ProposalVoteCastEvent.findOrCreate({
      where: {
        transactionHash: eventsData.transactionHash,
        network: this.network,
      },
      defaults: {
        proposalId,
        network: this.network,
        transactionHash: eventsData.transactionHash,
        voter: eventsData.returnValues.voter.toLowerCase(),
        contractProposalId: eventsData.returnValues.id,
        support: eventsData.returnValues.support,
        votes: eventsData.returnValues.votes,
        timestamp: block.timestamp,
      }
    });

    await ProposalParseBlock.update(
      { lastParsedBlock: eventsData.blockNumber },
      { where: { network: this.network } }
    );
  }

  protected async proposalExecutedEventHandler(eventsData: EventData) {
    const { proposalId } = await ProposalExecutedEvent.findOne({
      where: { contractProposalId: eventsData.returnValues.id },
    });

    const [executedEvent, isCreated] = await ProposalExecutedEvent.findOrCreate({
      where: {
        transactionHash: eventsData.transactionHash,
        network: this.network,
      },
      defaults: {
        proposalId,
        network: this.network,
        transactionHash: eventsData.transactionHash,
        contractProposalId: eventsData.returnValues.id,
        succeded: eventsData.returnValues.succeded,
        defeated: eventsData.returnValues.defeated,
      }
    });

    if (isCreated) {
      if (executedEvent.succeeded) {
        await Proposal.update({
          status: ProposalStatus.Accepted
        }, {
          where: { proposalId: executedEvent.proposalId }
        });
      } else if (executedEvent.defeated) {
        await Proposal.update({
          status: ProposalStatus.Rejected,
        }, {
          where: { proposalId: executedEvent.proposalId }
        })
      }
    }

    await ProposalParseBlock.update(
      { lastParsedBlock: eventsData.blockNumber },
      { where: { network: this.network } }
    );
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
