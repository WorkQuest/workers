import Web3 from "web3";
import {Op} from "sequelize";
import {ProposalEvents} from "./types";
import {EventData} from "web3-eth-contract";
import {addJob} from "../../../utils/scheduler";
import {BlocksRange} from "../../../middleware/middleware.types";
import {
  ILogger,
  IController,
  IContractProvider,
  IContractListenerProvider,
} from "../../../middleware/middleware.interfaces";
import {
  Proposal,
  Discussion,
  ProposalStatus,
  ProposalParseBlock,
  BlockchainNetworks,
  ProposalCreatedEvent,
  ProposalExecutedEvent,
  ProposalVoteCastEvent,
  DaoPlatformStatisticFields,
} from "@workquest/database-models/lib/models";

export class ProposalController implements IController {
  constructor (
    public readonly web3: Web3,
    protected readonly Logger: ILogger,
    public readonly network: BlockchainNetworks,
    public readonly contractProvider: IContractProvider,
  ) {
  }

  private writeDaoStatistic(incrementField: DaoPlatformStatisticFields, by?: string | number) {
    return addJob('writeActionStatistics', { incrementField, statistic: 'dao', by });
  }

  public async getLastCollectedBlock(): Promise<number> {
    const [{ lastParsedBlock }, ] = await ProposalParseBlock.findOrCreate({
      where: { network: this.network },
      defaults: {
        network: this.network,
        lastParsedBlock: this.contractProvider.eventViewingHeight,
      },
    });

    this.Logger.debug('Last collected block: "%s"', lastParsedBlock);

    return lastParsedBlock;
  }

  protected async updateBlockViewHeight(blockHeight: number) {
    this.Logger.debug('Update blocks: new block height "%s"', blockHeight);

    await ProposalParseBlock.update({ lastParsedBlock: blockHeight }, {
      where: {
        network: this.network,
        lastParsedBlock: { [Op.lt]: blockHeight },
      }
    });
  }

  protected async onEventHandler(eventsData: EventData) {
    this.Logger.info('Event handler: name "%s", block number "%s", address "%s"',
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

  protected async proposalCreatedEventHandler(eventsData: EventData) {
    const proposer = eventsData.returnValues.proposer.toLowerCase();
    const transactionHash = eventsData.transactionHash.toLowerCase();

    this.Logger.debug(
      'Proposal created event handler: event data %o',
      eventsData,
    );

    const proposal = await Proposal.findOne({
      where: { nonce: eventsData.returnValues.nonce },
    });

    const [createdEvent, isCreated] = await ProposalCreatedEvent.findOrCreate({
      where: { transactionHash, network: this.network },
      defaults: {
        proposer,
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
      this.Logger.warn('Proposal created event handler: event "%s" (tx hash "%s") handling is skipped because it has already been created',
        transactionHash,
        eventsData.event,
      );

      return;
    }

    const { timestamp } = await this.web3.eth.getBlock(eventsData.blockNumber);

    await createdEvent.update({ timestamp });

    if (!proposal) {
      this.Logger.warn('Proposal created event handler: event "%s" (tx hash "%s") handling is skipped because proposal (nonce "%s") not found',
        eventsData.event,
        transactionHash,
        eventsData.returnValues.nonce,
      );

      return;
    }

    this.Logger.debug('Proposal created event handler: event "%s" (tx hash "%s") found proposal (nonce "%s") %o',
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

    this.Logger.debug('Proposal created event handler: event "%s" (tx hash "%s") discussion was created for proposal %o',
      eventsData.event,
      transactionHash,
      discussion,
    );

    return Promise.all([
      discussion.$set('medias', proposal.medias), /** Duplicate medias  */
      proposal.update({ discussionId: discussion.id, status: ProposalStatus.Active }),
    ]);
  }

  protected async voteCastEventHandler(eventsData: EventData) {
    const voter = eventsData.returnValues.voter.toLowerCase();
    const transactionHash = eventsData.transactionHash.toLowerCase();

    this.Logger.debug(
      'Proposal vote cast event handler: event data %o',
      eventsData,
    );

    const proposalCreatedEvent = await ProposalCreatedEvent.findOne({
      where: { contractProposalId: eventsData.returnValues.proposalId },
    });

    const [voteCastEvent, isCreated] = await ProposalVoteCastEvent.findOrCreate({
      where: {
        transactionHash,
        network: this.network,
      },
      defaults: {
        voter,
        transactionHash,
        network: this.network,
        proposalId: proposalCreatedEvent ? proposalCreatedEvent.proposalId : null,
        contractProposalId: eventsData.returnValues.id,
        support: eventsData.returnValues.support,
        votes: eventsData.returnValues.votes,
      }
    });

    if (!isCreated) {
      this.Logger.warn('Proposal vote cast event handler: event "%s" (tx hash "%s") handling is skipped because it has already been created',
        eventsData.event,
        transactionHash,
      );

      return;
    }

    const { timestamp } = await this.web3.eth.getBlock(eventsData.blockNumber);

    await voteCastEvent.update({ timestamp });

    if (!proposalCreatedEvent) {
      this.Logger.warn('Proposal vote cast event handler: event "%s" (tx hash "%s") handling is skipped because proposal created event not found',
        eventsData.event,
        transactionHash,
      );

      return;
    }

    const incrementField = voteCastEvent.support
      ? DaoPlatformStatisticFields.VotesFor
      : DaoPlatformStatisticFields.VotesAgain;

    await this.writeDaoStatistic(incrementField);
    await this.writeDaoStatistic(DaoPlatformStatisticFields.Votes);
    await this.writeDaoStatistic(DaoPlatformStatisticFields.DelegatedValue, voteCastEvent.votes);
  }

  protected async proposalExecutedEventHandler(eventsData: EventData) {
    const transactionHash = eventsData.transactionHash.toLowerCase();

    this.Logger.debug(
      'Proposal executed event handler: event data %o',
      eventsData
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
        transactionHash,
        network: this.network,
        proposalId: proposalCreatedEvent ? proposalCreatedEvent.proposalId : null,
        contractProposalId: eventsData.returnValues.id,
        succeded: eventsData.returnValues.succeded,
        defeated: eventsData.returnValues.defeated,
      }
    });

    if (!isCreated) {
      this.Logger.warn('Proposal executed event handler: event "%s" (tx hash "%s") handling is skipped because it has already been created',
        eventsData.event,
        transactionHash,
      );

      return;
    }

    const { timestamp } = await this.web3.eth.getBlock(eventsData.blockNumber);

    await executedEvent.update({ timestamp });

    if (!proposalCreatedEvent) {
      this.Logger.warn('Proposal vote cast event handler: event "%s" (tx hash "%s") handling is skipped because proposal created event not found',
        eventsData.event,
        transactionHash,
      );

      return;
    }

    let proposalStatus = ProposalStatus.Active;
    if (executedEvent.succeeded && !executedEvent.defeated) {
      proposalStatus = ProposalStatus.Accepted;
    } else if (executedEvent.defeated && !executedEvent.succeeded) {
      proposalStatus = ProposalStatus.Rejected;
    }

    await Proposal.update(
      { status: proposalStatus },
      { where: { id: executedEvent.proposalId } },
    );
  }

  public async syncBlocks(callback?: () => void) {
    const blockRange: BlocksRange = {
      to: 'latest',
      from: await this.getLastCollectedBlock(),
    }

    this.Logger.info('Start collecting all uncollected events from block number: %s.', blockRange.from);

    await this.contractProvider.getEvents(blockRange, async (receivedEvents) => {
      for (const event of receivedEvents.events) {
        try {
          await this.onEventHandler(event);
          await this.updateBlockViewHeight(event.blockNumber);
        } catch (e) {
          this.Logger.error(e, 'Event processing ended with error');

          throw e;
        }
      }

      await this.updateBlockViewHeight(receivedEvents.lastBlockNumber);

      if (receivedEvents.error) {
        throw receivedEvents.error;
      }
      if (callback) {
        callback();
      }
    });
  }

  public async start() {

  }
}

export class ProposalListenerController extends ProposalController {
  constructor (
    public readonly web3: Web3,
    protected readonly Logger: ILogger,
    public readonly network: BlockchainNetworks,
    public readonly contractProvider: IContractListenerProvider,
  ) {
    super(web3, Logger, network, contractProvider);
  }

  public async start() {
    await super.start();

    this.contractProvider.startListener(
      await this.getLastCollectedBlock()
    );

    this.contractProvider.on('events', (async (eventData) => {
      await this.onEventHandler(eventData);
    }));
  }
}

export class ProposalRouterController extends ProposalListenerController {
  constructor(
    public readonly web3: Web3,
    protected readonly Logger: ILogger,
    public readonly network: BlockchainNetworks,
    public readonly contractProvider: IContractListenerProvider,
  ) {
    super(web3, Logger, network, contractProvider);
  }
}
