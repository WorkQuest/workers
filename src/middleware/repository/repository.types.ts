export type QuestContractsPayload = {
  nonce: number,
  transactionHash: string,
}

export type BlockchainRepositoryOptions = {
  /**
   * Get logs by step range.
   * (from, from + stepsRange)
   */
  stepsRange: number,
}
