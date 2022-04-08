import { addJob } from "../../utils/scheduler";

export interface Data {
  userId: string;
  runAt: Date;
}

export async function updateUserRaiseViewStatusJob(payload: Data) {
  return addJob('updateUserRaiseViewStatus', payload, {'run_at': payload.runAt});
}
