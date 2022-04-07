import {Quest, QuestStatus, User} from "@workquest/database-models/lib/models";

export class QuestModelController {
  constructor(
    public readonly quest: Quest
  ) {
  }

  public assignWorkerOnQuest(worker: User): Promise<any> {
    return this.quest.update({
      assignedWorkerId: worker.id,
      status: QuestStatus.WaitingForConfirmFromWorkerOnAssign,
    });
  }

  public editQuest(payload: { price: any }) {
    return this.quest.update({ price: payload.price });
  }

  public closeQuest(): Promise<any> {
    return this.quest.update({ status: QuestStatus.Closed });
  }

  public startQuest(): Promise<any> {
    return this.quest.update({ status: QuestStatus.ExecutionOfWork });
  }

  public finishWork(): Promise<any> {
    return this.quest.update({ status: QuestStatus.WaitingForEmployerConfirmationWork });
  }

  public completeQuest(): Promise<any> {
    return this.quest.update({ status: QuestStatus.Completed });
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
