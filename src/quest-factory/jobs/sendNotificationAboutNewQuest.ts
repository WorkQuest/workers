import { addJob } from "../../utils/scheduler";

export async function sendNotificationAboutNewQuest(questId: string) {
  return addJob('sendNotificationAboutNewQuest', { questId });
}