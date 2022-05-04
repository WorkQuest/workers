import { DisputeStatus, Quest, QuestDispute } from "@workquest/database-models/lib/models";

export class QuestDisputeModelController {
  constructor(
    public readonly dispute: QuestDispute,
  ) {}

  public startDispute(): Promise<QuestDispute> {
    return this.dispute.update({ status: DisputeStatus.InProgress });
  }

  public closeDispute(): Promise<QuestDispute> {
    return this.dispute.update({
      resolvedAt: new Date(),
      status: DisputeStatus.Closed,
    });
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
