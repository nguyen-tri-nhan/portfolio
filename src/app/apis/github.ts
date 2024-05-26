import axios from "axios";
import { GithubFile } from "./model/github";

const REPO = process.env.NEXT_PUBLIC_CONTENT_GITHUB_REPO;
const USER = process.env.NEXT_PUBLIC_CONTENT_GITHUB_USERNAME;
const TOKEN = process.env.NEXT_PUBLIC_GITHUB_TOKEN;

const BASE_URL = `https://api.github.com/repos/${USER}/${REPO}/contents`;

export const fetchGitHubContent = async (
  path: string
): Promise<GithubFile[]> => {
  const res = await axios.get(`${BASE_URL}/${path}`, {
    headers: {
      Authorization: `token ${TOKEN}`,
    },
  });
  return res.data;
};

export const fetchFileContent = async (path: string): Promise<string> => {
  const res = await axios.get(`${BASE_URL}/${path}`, {
    headers: {
      Authorization: `token ${process.env.GITHUB_TOKEN}`,
    },
  });
  const file = res.data;
  return Buffer.from(file.content, 'base64').toString('utf-8');
};