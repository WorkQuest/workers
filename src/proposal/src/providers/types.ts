import { IContractProvider, onEventCallBack, Clients } from '../../../types';
import {WebsocketClient as TendermintWebsocketClient} from "@cosmjs/tendermint-rpc/build/rpcclients/websocketclient";

export interface ProposalClients extends Clients {
  tendermintWsClient?: TendermintWebsocketClient;
}

export {
  onEventCallBack,
  IContractProvider,
}
