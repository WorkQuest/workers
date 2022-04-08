import {QuestModelController} from "./QuestModelController";
import {QuestsResponse, QuestsResponseStatus } from "@workquest/database-models/lib/models";

export class QuestResponsesModelController {
  constructor(
    public readonly questController: QuestModelController,
  ) {
  }

  public closeAllResponses(): Promise<any> {
    return QuestsResponse.update({ status: QuestsResponseStatus.Closed }, {
      where: { questId: this.questController.quest.id },
    });
  }

  public closeAllWorkingResponses(): Promise<any> {
    return QuestsResponse.update({ status: QuestsResponseStatus.Closed }, {
      where: {
        questId: this.questController.quest.id,
        status: [QuestsResponseStatus.Accepted, QuestsResponseStatus.Open],
      },
    });
  }
}
