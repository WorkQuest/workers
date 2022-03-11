import {Op} from 'sequelize';
import {QuestModelController} from "./QuestModelController";
import {QuestChat, QuestChatStatuses} from "@workquest/database-models/lib/models";

export class QuestChatModelController {
  constructor(
    public readonly questController: QuestModelController,
  ) {
  }

  public closeAllWorkChatsExceptAssignedWorker(): Promise<void> {
    return void QuestChat.update({ status: QuestChatStatuses.Close }, {
      where: {
        questId: this.questController.quest.id,
        workerId: { [Op.ne]: this.questController.quest.assignedWorkerId },
      },
    });
  }
}
