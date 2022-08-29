import {BlockchainNetworks} from "@workquest/database-models/lib/models";
import {
  Store,
  Networks,
  BnbNetworkContracts,
  EthNetworkContracts,
  WorkQuestNetworkContracts,
} from "@workquest/contract-data-pools";

export function getBridgeContractDataByNetwork(network: BlockchainNetworks) {
  if (
    network === BlockchainNetworks.workQuestNetwork ||
    network === BlockchainNetworks.workQuestDevNetwork
  ) {
    return Store[Networks.WorkQuest][WorkQuestNetworkContracts.WqtBridge];
  }
  if (
    network === BlockchainNetworks.bscMainNetwork ||
    network === BlockchainNetworks.bscTestNetwork
  ) {
    return Store[Networks.Bnb][BnbNetworkContracts.WqtBridge];
  }
  if (
    network === BlockchainNetworks.rinkebyTestNetwork ||
    network === BlockchainNetworks.ethMainNetwork
  ) {
    return Store[Networks.Eth][EthNetworkContracts.WqtBridge];
  }
}
