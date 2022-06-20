import { QuestRaiseType, UserRaiseType } from "@workquest/database-models/lib/models";

export enum RaiseViewEvent {
  Profile = 'PromotedUser',
  Quest = 'PromotedQuest',
}

export type StatisticPayload = {
  newTariff: UserRaiseType | QuestRaiseType;
  oldTariff: UserRaiseType | QuestRaiseType;
  amount: string;
}

export * from '../../../types';

