import axios from "axios";
import { GithubFile } from "../model/github";
import { GITHUB, GITHUB_FILE } from "./apis";
import { CategoryItem } from "../utils/contants";
import { getLanguage } from "../utils/localStorage";

type GetPostParams = {
  category: CategoryItem;
};

type GetPostContentParams = GetPostParams & {
  fileName: string;
};

export const getPosts = async ({
  category,
}: GetPostParams): Promise<GithubFile[] | undefined> => {
  const language = getLanguage();
  const path = GITHUB.replace(":category", category);
  const params = new URLSearchParams({ language }).toString();
  const response = await axios.get(`${path}?${params}`);
  if (response.status === 200) {
    return response.data as GithubFile[];
  }
  return;
};

export const getPostContent = async ({
  category,
  fileName,
}: GetPostContentParams): Promise<string | undefined> => {
  const language = getLanguage();
  const params = new URLSearchParams({ fileName, language }).toString();
  const path = `${GITHUB_FILE.replace(":category", category)}?${params}`;
  const response = await axios.get(path);
  if (response.status === 200) {
    return response.data as string;
  }
  return;
};
