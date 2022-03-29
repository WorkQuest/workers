import { IContractProvider, onEventCallBack, Clients } from '../../../types';
import { WebsocketClient as TendermintWebsocketClient } from "@cosmjs/tendermint-rpc/build/rpcclients/websocketclient";

export interface BridgeClients extends Clients {
  readonly webSocketProvider?: any;
  readonly tendermintWsClient?: TendermintWebsocketClient;
}

export {
  onEventCallBack,
  IContractProvider,
}
