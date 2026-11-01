import { notFound } from "@/lib/errors";
import type { GitHubProfile } from "@/lib/github";
import type { UserDTO } from "@/lib/types";
import { User, type UserDoc } from "@/models/User";

const toDTO = (u: UserDoc): UserDTO => ({ id: u._id.toString(), username: u.username, avatarUrl: u.avatarUrl });

/** GitHub id 기준으로 사용자를 만들거나 username/avatar를 최신 값으로 갱신한다. */
export async function upsertGitHubUser(profile: GitHubProfile): Promise<UserDTO> {
  const user = await User.findOneAndUpdate(
    { githubId: profile.githubId },
    { $set: { username: profile.username, avatarUrl: profile.avatarUrl } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  ).lean<UserDoc>();
  return toDTO(user!);
}

export async function getUser(id: string): Promise<UserDTO> {
  const user = await User.findById(id).lean<UserDoc>();
  if (!user) throw notFound("사용자를 찾을 수 없습니다");
  return toDTO(user);
}
