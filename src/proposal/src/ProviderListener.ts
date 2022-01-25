import { ProposalContract, ProposalEventType } from './ProposalContract';
import {
  Proposal,
  ProposalStatus,
  ProposalParseBlock,
  BlockchainNetworks,
  ProposalCreatedEvent,
  ProposalVoteCastEvent,
  ProposalExecutedEvent,
  Discussion,
} from '@workquest/database-models/lib/models';

export enum TrackedEvents {
  ProposalCreated = 'ProposalCreated',
  VoteCast = 'VoteCast',
  ProposalExecuted = 'ProposalExecuted',
}

abstract class ProviderListener {
  protected readonly _contract: ProposalContract;
  protected readonly _parserBlockInfo: ProposalParseBlock;

  protected constructor(contract: ProposalContract, parserBlockInfo: ProposalParseBlock) {
    this._contract = contract;
    this._parserBlockInfo = parserBlockInfo;

    this._contract.signCallbackOnEvent(this._onEvent);
  }

  protected abstract _parseProposalCreatedEvent(data: any): Promise<void>;

  protected abstract _parseVoteCastEvent(data: any): Promise<void>;

  protected abstract _parseProposalExecutedEvent(data: any): Promise<void>;

  public async parseProposalCreated() {
    for await (const events of this._contract.preParsingEvents()) {
      for (const event of events) await this._onEvent(event);
    }
  }

  protected _onEvent = async (event: ProposalEventType): Promise<void> => {
    console.log('New event: type ', event.event, ' tx hash ', event.transactionHash);
    if (event.event === TrackedEvents.ProposalCreated) {
      await this._parseProposalCreatedEvent(event);
    } else if (event.event === TrackedEvents.VoteCast) {
      await this._parseVoteCastEvent(event);
    } else if (event.event === TrackedEvents.ProposalExecuted) {
      await this._parseProposalExecutedEvent(event);
    }
    this._parserBlockInfo.lastParsedBlock = event.blockNumber;

    await this._parserBlockInfo.save();
  };

  start(): Promise<void> {
    return this._contract.startListener();
  }
}

export class ProposalEthListener extends ProviderListener {
  constructor(contract: ProposalContract, parserBlockInfo: ProposalParseBlock) {
    super(contract, parserBlockInfo);
    console.log();
  }

  protected async _parseProposalCreatedEvent(event: ProposalEventType): Promise<void> {
    try {
      const [proposalEvent, isCreated] = await ProposalCreatedEvent.findOrCreate({
        where: {
          transactionHash: event.transactionHash,
          timestamp: event.timestamp,
        },
        defaults: {
          timestamp: event.timestamp,
          nonce: event.nonce,
          transactionHash: event.transactionHash,
          proposalId: event.transId,
          proposer: event.proposer.toLowerCase(),
          description: event.description,
          votingPeriod: event.votingPeriod,
          minimumQuorum: event.minimumQuorum,
          network: BlockchainNetworks.rinkebyTestNetwork, // TODO
        },
      });
      if (isCreated) {
        const proposal = await Proposal.findOne({
          where: {
            proposer: proposalEvent.proposer.toLowerCase(),
            nonce: proposalEvent.nonce,
          },
        });
        const discussion = await Discussion.create({
          authorId: proposal.userId,
          title: proposal.title,
          description: proposal.description,
        });

        await discussion.$set('medias', proposal.medias);

        await proposal.update({
          discussionId: discussion.id,
          status: ProposalStatus.Active,
          txHash: proposalEvent.transactionHash,
          votingPeriod: proposalEvent.votingPeriod,
          minimumQuorum: proposalEvent.minimumQuorum,
          timestamp: proposalEvent.timestamp,
          proposalId: proposalEvent.proposalId,
        });
      }
    } catch (err) {
      console.log(err);
    }
  }

  protected async _parseVoteCastEvent(event: ProposalEventType): Promise<void> {
    try {
      const VoteCastEvent = await ProposalVoteCastEvent.findOrCreate({
        where: {
          transactionHash: event.transactionHash,
          timestamp: event.timestamp,
        },
        defaults: {
          transactionHash: event.transactionHash,
          voter: event.voter.toLowerCase(),
          proposalId: event.proposalId,
          support: event.support,
          votes: event.votes,
          timestamp: event.timestamp,
          network: BlockchainNetworks.rinkebyTestNetwork, // TODO
        },
      });
    } catch (err) {
      console.log(err);
    }
  }

  protected async _parseProposalExecutedEvent(event: ProposalEventType): Promise<void> {
    try {
      const [ProposalExecutives, isCreated] = await ProposalExecutedEvent.findOrCreate({
        where: {
          transactionHash: event.transactionHash,
          proposalId: event.transId,
        },
        defaults: {
          transactionHash: event.transactionHash,
          proposalId: event.transId,
          succeeded: event.succeded,
          defeated: event.defeated,
          network: BlockchainNetworks.rinkebyTestNetwork, // TODO
        },
      });
      if (isCreated) {
        if (ProposalExecutives.succeeded === true) {
          await Proposal.update(
            {
              status: ProposalStatus.Accepted,
            },
            {
              where: {
                proposalId: ProposalExecutives.proposalId,
              },
            },
          );
        } else if (ProposalExecutives.defeated === true) {
          await Proposal.update(
            {
              status: ProposalStatus.Rejected,
            },
            {
              where: {
                proposalId: ProposalExecutives.proposalId,
              },
            },
          );
        }
      }
    } catch (err) {
      console.log(err);
    }
  }
}
