import { DisputeDecision, DisputeStatus, Quest, QuestDispute } from "@workquest/database-models/lib/models";
import { Op } from "sequelize";

export class QuestDisputeModelController {
  constructor(
    public readonly dispute: QuestDispute,
  ) {}

  public confirmDispute(): Promise<QuestDispute> {
    return this.dispute.update({ status: DisputeStatus.Created });
  }

  public closeDispute(decision: DisputeDecision, timestamp: string): Promise<any> {
    const resolvedAt = new Date(parseInt(timestamp) * 1000);

    return this.dispute.update({
        status: DisputeStatus.Closed,
        resolvedAt,
        decision,
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

    const dispute = await QuestDispute.findOne({
      where: {
        questId: quest.id,
        status: { [Op.ne]: DisputeStatus.Closed },
      }
    });

    if (!dispute) {
      return null;
    }

    return new QuestDisputeModelController(dispute);
  }
}
