import { addJob } from "../../utils/scheduler";

export interface StatisticPayload {
  userId: string;
}

export async function addUpdateReviewStatisticsJob(payload: StatisticPayload) {
  return addJob('updateReviewStatistics', payload);
}
