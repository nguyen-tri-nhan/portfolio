import axios from "axios";
import dotenv from 'dotenv';
import { GithubFile } from "../model/github";
import { resolveImagePaths } from "../utils/markdownHandler";

// Load environment variables from .env file
dotenv.config();

const GITHUB_TOKEN = process.env.GITHUB_TOKEN ?? "";
const GITHUB_USERNAME = process.env.GITHUB_USERNAME;
const GITHUB_REPO = process.env.GITHUB_REPO;

const BASE_URL = `https://api.github.com/repos/${GITHUB_USERNAME}/${GITHUB_REPO}/contents`;

const headers = {
  Authorization: `token ${GITHUB_TOKEN}`,
};

export const fetchGitHubContent = async (
  path: string
): Promise<GithubFile[] | undefined> => {
  try {
    const res = await axios.get(`${BASE_URL}/${path}`, {
      headers,
    });
    return res.data;
  } catch (error) {
    return;
  }
};

export const fetchFileContent = async (path: string): Promise<string | undefined> => {
  try {
    const res = await axios.get(`${BASE_URL}/${path}`, {
      headers,
    });
    const file: GithubFile = res.data;
    if (file.type !== "file" || !file.download_url) {
      return;
    }
    const content = await axios.get(file.download_url);
    const markdown = content.data;
    const resolvedMarkdown = resolveImagePaths(markdown);
    return resolvedMarkdown;
  } catch (error) {
    return;
  }
};
