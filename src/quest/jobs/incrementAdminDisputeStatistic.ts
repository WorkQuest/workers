import { addJob } from '../../utils/scheduler';

export type adminDisputeStatisticPayload = {
  adminId: string
  resolutionTimeInSeconds: number,
};

export async function incrementAdminDisputeStatisticJob(payload: adminDisputeStatisticPayload) {
  return addJob('incrementAdminDisputeStatistic', payload);
}
