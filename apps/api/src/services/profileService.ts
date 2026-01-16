import type { ProfileSummary } from "@ika/shared";
import type { Repository } from "../repository/types";

export async function getProfileSummary(
  repo: Repository,
  userId: string
): Promise<ProfileSummary> {
  const user = await repo.findUser(userId);
  const ratings = await repo.listRatingsByUser(userId);
  return { user, ratings };
}
