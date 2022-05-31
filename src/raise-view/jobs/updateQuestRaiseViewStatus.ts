import { addJob } from "../../utils/scheduler";

export interface Data {
  questId: string;
  runAt: Date;
}

export async function updateQuestRaiseViewStatusJob(payload: Data) {
  return addJob('updateQuestRaiseViewStatus', payload, {'run_at': payload.runAt});
}
