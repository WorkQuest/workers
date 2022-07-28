
/**
 * Key value repository is intended to store useful data
 *  for frequent access. For example, contracts that are
 *  created by means of factories
 */
export interface IKeyValueRepository<TPayload> {
  on(type: 'close', callback: () => void);
  on(type: 'error', callback: (error) => void);

  getKeys(): Promise<string[]>;
  remove(key: string): Promise<void>;
  get(key: string): Promise<TPayload | null>;
  set(key: string, payload: TPayload): Promise<void>;
}
