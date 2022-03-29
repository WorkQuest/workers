import {IQuestCacheProvider} from '../../../quest/src/providers/types'
import { IContractProvider, onEventCallBack, Clients } from '../../../types';
import {WebsocketClient as TendermintWebsocketClient} from "@cosmjs/tendermint-rpc/build/rpcclients/websocketclient";

export interface QuestFactoryClients extends Clients {
  readonly questCacheProvider: IQuestCacheProvider;
  readonly tendermintWsClient?: TendermintWebsocketClient;
}

export {
  onEventCallBack,
  IContractProvider,
}

