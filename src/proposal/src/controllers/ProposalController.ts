import { Op } from "sequelize";
import { Logger } from "../../logger/pino";
import { EventData } from "web3-eth-contract";
import { addJob } from "../../../utils/scheduler";
import { IController, ProposalEvents } from "./types";
import {
  Clients,
  IContractMQProvider,
  IContractProvider,
  IContractRpcProvider,
  IContractWsProvider,
} from "../../../types";
import {
  Proposal,
  Discussion,
  ProposalStatus,
  ProposalParseBlock,
  BlockchainNetworks,
  ProposalCreatedEvent,
  ProposalVoteCastEvent,
  ProposalExecutedEvent,
  DaoPlatformStatisticFields,
  ProposalDelegateChangedEvent,
  ProposalDelegateVotesChangedEvent,
} from "@workquest/database-models/lib/models";

export class ProposalController implements IController {
  constructor (
    public readonly clients: Clients,
    public readonly network: BlockchainNetworks,
    public readonly contractProvider: IContractProvider | IContractRpcProvider,
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

    Logger.debug('Last collected block: "%s"', lastParsedBlock);

    return lastParsedBlock;
  }

  protected async updateBlockViewHeight(blockHeight: number) {
    Logger.debug('Update blocks: new block height "%s"', blockHeight);

    await ProposalParseBlock.update({ lastParsedBlock: blockHeight }, {
      where: {
        network: this.network,
        lastParsedBlock: { [Op.lt]: blockHeight },
      }
    });
  }

  protected async onEvent(eventsData: EventData) {
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
    } else if (eventsData.event === ProposalEvents.DelegateChanged) {
      return this.proposalDelegateChangedEventHandler(eventsData);
    } else if (eventsData.event === ProposalEvents.DelegateVotesChanged) {
      return this.proposalDelegateVotesChangedEventHandler(eventsData);
    }
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

    return Promise.all([
      discussion.$set('medias', proposal.medias), /** Duplicate medias  */
      this.updateBlockViewHeight(eventsData.blockNumber),
      proposal.update({ discussionId: discussion.id, status: ProposalStatus.Active }),
    ]);
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

    const [voteCastEvent, isCreated] = await ProposalVoteCastEvent.findOrCreate({
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

    const incrementField = voteCastEvent.support
      ? DaoPlatformStatisticFields.VotesFor
      : DaoPlatformStatisticFields.VotesAgain;

    await this.writeDaoStatistic(incrementField);
    await this.writeDaoStatistic(DaoPlatformStatisticFields.Votes);
    await this.writeDaoStatistic(DaoPlatformStatisticFields.DelegatedValue, voteCastEvent.votes)

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
        succeeded: eventsData.returnValues.succeded,
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


    let proposalStatus = ProposalStatus.Active;
    if (executedEvent.succeeded && !executedEvent.defeated) {
      proposalStatus = ProposalStatus.Accepted;
    } else if (executedEvent.defeated && !executedEvent.succeeded) {
      proposalStatus = ProposalStatus.Rejected;
    }

    return Promise.all([
      this.updateBlockViewHeight(eventsData.blockNumber),
      Proposal.update(
        { status: proposalStatus },
        { where: { id: executedEvent.proposalId } },
      ),
    ]);
  }

  protected async proposalDelegateChangedEventHandler(eventsData: EventData) {
    const { timestamp } = await this.clients.web3.eth.getBlock(eventsData.blockNumber);

    const transactionHash = eventsData.transactionHash.toLowerCase();

    const delegator = eventsData.returnValues.delegator.toLowerCase();
    const fromDelegate = eventsData.returnValues.fromDelegate.toLowerCase();
    const toDelegate = eventsData.returnValues.toDelegate.toLowerCase();

    Logger.debug(
      'Proposal delegate changed event handler: timestamp "%s", event data %o',
      timestamp, eventsData
    );

    const [, isCreated] = await ProposalDelegateChangedEvent.findOrCreate({
      where: {
        transactionHash,
        network: this.network,
      },
      defaults: {
        timestamp,
        delegator,
        toDelegate,
        fromDelegate,
        transactionHash,
        network: this.network,
        blockNumber: eventsData.blockNumber,
      }
    });

    if (!isCreated) {
      Logger.warn('Proposal delegate changed event handler: event "%s" (tx hash "%s") handling is skipped because it has already been created',
        eventsData.event,
        transactionHash,
      );

      return;
    }

    return this.updateBlockViewHeight(eventsData.blockNumber);
  }

  protected async proposalDelegateVotesChangedEventHandler(eventsData: EventData) {
    const { timestamp } = await this.clients.web3.eth.getBlock(eventsData.blockNumber);

    const transactionHash = eventsData.transactionHash.toLowerCase();

    const delegator = eventsData.returnValues.delegator.toLowerCase();
    const delegatee = eventsData.returnValues.delegatee.toLowerCase();

    Logger.debug(
      'Proposal delegate changed event handler: timestamp "%s", event data %o',
      timestamp, eventsData
    );

    const [, isCreated] = await ProposalDelegateVotesChangedEvent.findOrCreate({
      where: {
        transactionHash,
        network: this.network,
      },
      defaults: {
        timestamp,
        delegator,
        delegatee,
        transactionHash,
        network: this.network,
        blockNumber: eventsData.blockNumber,
        newBalance: eventsData.returnValues.newBalance,
        previousBalance: eventsData.returnValues.previousBalance,
      }
    });

    if (!isCreated) {
      Logger.warn('Proposal delegate votes changes event handler: event "%s" (tx hash "%s") handling is skipped because it has already been created',
        eventsData.event,
        transactionHash,
      );

      return;
    }

    return this.updateBlockViewHeight(eventsData.blockNumber);
  }

  public async collectAllUncollectedEvents(fromBlockNumber: number) {
    Logger.info('Start collecting all uncollected events from block number: %s.', fromBlockNumber);

    const { events, error, lastBlockNumber } = await this.contractProvider.getEvents(fromBlockNumber);

    for (const event of events) {
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

  public async syncBlocks() {
    const lastParsedBlock = await this.getLastCollectedBlock();

    await this.collectAllUncollectedEvents(lastParsedBlock);
  }

  public async start() {
    await this.collectAllUncollectedEvents(
      await this.getLastCollectedBlock()
    );

  }
}

export class ProposalListenerController extends ProposalController {
  constructor (
    public readonly clients: Clients,
    public readonly network: BlockchainNetworks,
    public readonly contractProvider: IContractWsProvider | IContractMQProvider,
  ) {
    super(clients, network, contractProvider);
  }

  public async start() {
    await super.start();

    this.contractProvider.startListener(
      await this.getLastCollectedBlock()
    );

    this.contractProvider.on('events', (async (eventData) => {
      await this.onEvent(eventData);
    }));
  }
}
