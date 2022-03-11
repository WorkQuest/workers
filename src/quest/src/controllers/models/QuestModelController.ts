import {Quest, QuestStatus, User} from "@workquest/database-models/lib/models";

export class QuestModelController {
  constructor(
    public readonly quest: Quest
  ) {
  }

  public assignWorkerOnQuest(worker: User): Promise<void> {
    return void this.quest.update({
      assignedWorkerId: worker.id,
      status: QuestStatus.WaitingForConfirmFromWorkerOnAssign,
    });
  }

  public startQuest(): Promise<void> {
    return void this.quest.update({ status: QuestStatus.ExecutionOfWork });
  }

  public statusDoesMatch(...statuses: QuestStatus[]): boolean {
    return statuses.includes(this.quest.status);
  }

  static async byId(id: string): Promise<QuestModelController | null> {
    const quest = await Quest.findByPk(id);

    if (!quest) {
      return null;
    }

    return new QuestModelController(quest);
  }

  static async byContractAddress(address: string): Promise<QuestModelController | null> {
    const quest = await Quest.findOne({ where: { contractAddress: address } });

    if (!quest) {
      return null;
    }

    return new QuestModelController(quest);
  }
}
