import { IContractProvider, onEventCallBack, Clients } from '../../../types';
import {WebsocketClient as TendermintWebsocketClient} from "@cosmjs/tendermint-rpc/build/rpcclients/websocketclient";

export interface ReferralClients extends Clients {
  readonly tendermintWsClient?: TendermintWebsocketClient;
}

export {
  onEventCallBack,
  IContractProvider,
}
