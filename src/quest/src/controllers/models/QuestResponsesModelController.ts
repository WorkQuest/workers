import {QuestModelController} from "./QuestModelController";
import {QuestsResponse} from "@workquest/database-models/lib/models";
import {QuestsResponseStatus} from "@workquest/database-models/src/models/quest/QuestsResponse";

export class QuestResponsesModelController {
  constructor(
    public readonly questController: QuestModelController,
  ) {
  }

  public async closeAllWorkingResponses() {
    await QuestsResponse.update({ status: QuestsResponseStatus.Closed }, {
      where: {
        questId: this.questController.quest.id,
        status: [QuestsResponseStatus.Accepted, QuestsResponseStatus.Open],
      },
    });
  }
}
