import { fetchFileContent, fetchGitHubContent } from "../apis/githubApis";
import { GithubFile } from "../model/github";
import { getGithubMarkdownThumbnail } from "../utils/githubFileHelper";

export const getGithubFiles = async (
  path: string,
  category: string
): Promise<GithubFile[] | undefined> => {
  const githubFiles = await fetchGitHubContent(`${path}/${category}`);
  if (!githubFiles) {
    return;
  }

  const transferedFile = githubFiles
    .filter((file: GithubFile) => file.type === "file")
    .map((file: GithubFile) => ({
      ...file,
      thumbnail: getGithubMarkdownThumbnail({
        path: `${category}/${file.name}`,
      }),
    }));

  return transferedFile;
};

export const getGithubFileContent = async (
  path: string
): Promise<string | undefined> => {
  return await fetchFileContent(path);
};
