import { QuestModelController } from "./QuestModelController";
import { QuestsResponse, QuestsResponseStatus } from "@workquest/database-models/lib/models";
import { Op } from "sequelize";

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

  public getActiveResponses(): Promise<any> {
    return QuestsResponse.findAll({
      where: {
        status: { [Op.or]: [QuestsResponseStatus.Open, QuestsResponseStatus.Accepted] },
        questId: this.questController.quest.id
      }
    });
  }
}
