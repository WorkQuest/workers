import {Op} from 'sequelize';
import {QuestModelController} from "./QuestModelController";
import {QuestChat, QuestChatStatus} from "@workquest/database-models/lib/models";

export class QuestChatModelController {
  constructor(
    public readonly questController: QuestModelController,
  ) {
  }

  public closeAllChats(): Promise<void> {
    return void QuestChat.update({ status: QuestChatStatus.Close }, {
      where: { questId: this.questController.quest.id },
    });
  }

  public closeAllWorkChatsExceptAssignedWorker(): Promise<void> {
    return void QuestChat.update({ status: QuestChatStatus.Close }, {
      where: {
        questId: this.questController.quest.id,
        workerId: { [Op.ne]: this.questController.quest.assignedWorkerId },
      },
    });
  }
}
