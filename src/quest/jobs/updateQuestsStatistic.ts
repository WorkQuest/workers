import { addJob } from "../../utils/scheduler";
import { UserRole } from "@workquest/database-models/lib/models";

export interface Data {
  userId: string;
  role: UserRole;
}

export async function updateQuestsStatisticJob(payload: Data) {
  return addJob('updateQuestsStatistic', payload);
}
