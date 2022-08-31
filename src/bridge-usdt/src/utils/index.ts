import {BlockchainNetworks} from "@workquest/database-models/lib/models";
import {
  Store,
  Networks,
  EthNetworkContracts,
  BnbNetworkContracts,
  PolygonScanContracts,
} from "@workquest/contract-data-pools";

export function getBridgeUsdtContractDataByNetwork(network: BlockchainNetworks) {
  if (
    network === BlockchainNetworks.polygonMainNetwork ||
    network === BlockchainNetworks.mumbaiTestNetwork
  ) {
    return Store[Networks.PolygonScan][PolygonScanContracts.BridgeUSDT];
  }
  if (
    network === BlockchainNetworks.bscMainNetwork ||
    network === BlockchainNetworks.bscTestNetwork
  ) {
    return Store[Networks.Bnb][BnbNetworkContracts.BridgeUSDT];
  }
  if (
    network === BlockchainNetworks.rinkebyTestNetwork ||
    network === BlockchainNetworks.ethMainNetwork
  ) {
    return Store[Networks.Eth][EthNetworkContracts.BridgeUSDT];
  }
}

export * from "./scheduler";
