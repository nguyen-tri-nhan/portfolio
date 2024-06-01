import { GithubThumbnail } from "../model/github";
import { repoUrl } from "./repoHelper";

type GithubThumbnailProps = {
  path: string;
};

export const getGithubMarkdownThumbnail = ({
  path,
}: GithubThumbnailProps): GithubThumbnail => {
  return {
    thumbnail: `${repoUrl}/images/${path}/thumbnail.png`,
    fallback: `${repoUrl}/images/default.png`,
  }
};
