import axios from "axios";
import { GithubFile } from "./model/github";
import { base64ToString } from "../utils/crypto";
import { GITHUB, GITHUB_FILE } from "./path";


export const fetchGitHubContent = async (
  category: string
): Promise<GithubFile[]> => {
  const url = GITHUB.replace(":category", category);
  const res = await axios.get(url);
  console.log(res);
  return res.data;
};

export const fetchGithubFileContent = async (category: string, fileName: string): Promise<string> => {
  const url = GITHUB_FILE.replace(":category", category);
  const queryParam = new URLSearchParams({ fileName }).toString();
  const res = await axios.get(`${url}?${queryParam}`);
  const file = res.data;
  return file;
};