import {QuestModelController} from "./QuestModelController";
import {QuestsResponse, QuestsResponseStatus } from "@workquest/database-models/lib/models";

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
