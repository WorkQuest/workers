import { DisputeDecision, DisputeStatus, Quest, QuestDispute } from "@workquest/database-models/lib/models";
import { incrementAdminDisputeStatisticJob } from "../../../jobs/incrementAdminDisputeStatistic";

export class QuestDisputeModelController {
  constructor(
    public readonly dispute: QuestDispute,
  ) {}

  public setCreatedStatus(): Promise<QuestDispute> {
    return this.dispute.update({ status: DisputeStatus.Created });
  }

  public closeDispute(decision: DisputeDecision, timestamp: string): Promise<any> {
    const resolvedAt = new Date(parseInt(timestamp) * 1000);

    return Promise.all([
      this.dispute.update({
        status: DisputeStatus.Closed,
        resolvedAt,
        decision,
      }),
      incrementAdminDisputeStatisticJob({
        adminId: this.dispute.assignedAdminId,
        resolutionTimeInSeconds: (resolvedAt.getTime() - this.dispute.acceptedAt.getTime()) / 1000,
      }),
    ]);
  }

  public statusDoesMatch(...statuses: DisputeStatus[]): boolean {
    return statuses.includes(this.dispute.status);
  }

  static async byContractAddress(address: string): Promise<QuestDisputeModelController | null> {
    const quest = await Quest.findOne({ where: { contractAddress: address } });

    if (!quest) {
      return null;
    }

    const dispute = await QuestDispute.findOne({ where: { questId: quest.id } });

    if (!dispute) {
      return null;
    }

    return new QuestDisputeModelController(dispute);
  }
}
