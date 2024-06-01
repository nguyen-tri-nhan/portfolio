export type GithubThumbnail = {
  thumbnail: string;
  fallback: string;
};

export type GithubFile = {
  name: string;
  path: string;
  sha: string;
  type: string;
  content?: string;
  download_url?: string;
  thumbnail?: GithubThumbnail;
};
