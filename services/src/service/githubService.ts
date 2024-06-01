import { fetchFileContent, fetchGitHubContent } from "../apis/githubApis";
import { GithubFile } from "../model/github";
import { getGithubMarkdownThumbnail } from "../utils/githubFileHelper";

export const getGithubFiles = async (
  category: string
): Promise<GithubFile[] | undefined> => {
  const githubFiles = await fetchGitHubContent(category);
  if (!githubFiles) {
    return;
  }

  const transferedFile = githubFiles.filter(
    (file: GithubFile) => file.type === "file"
  ).map((file: GithubFile) => {
    return {
      ...file,
      thumbnail: getGithubMarkdownThumbnail({ path: file.path }),
    };
  });

  return transferedFile;
};

export const getGithubFileContent = async (
  path: string
): Promise<string | undefined> => {
  return await fetchFileContent(path);
};
