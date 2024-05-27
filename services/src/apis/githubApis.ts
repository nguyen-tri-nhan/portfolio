import axios from "axios";
import { GithubFile } from "../model/github";

const GITHUB_TOKEN = process.env.GITHUB_TOKEN ?? "";
const GITHUB_USERNAME = process.env.GITHUB_USERNAME;
const GITHUB_REPO = process.env.GITHUB_REPO;

const BASE_URL = `https://api.github.com/repos/${GITHUB_USERNAME}/${GITHUB_REPO}/contents`;

const headers = {
  Authorization: `token ${GITHUB_TOKEN}`,
};

export const fetchGitHubContent = async (
  path: string
): Promise<GithubFile[]> => {
  const res = await axios.get(`${BASE_URL}/${path}`, {
    headers,
  });
  return res.data;
};

export const fetchFileContent = async (path: string): Promise<string> => {
  const res = await axios.get(`${BASE_URL}/${path}`, {
    headers,
  });
  const file = res.data;
  return Buffer.from(file.content, "base64").toString("utf-8");
};
