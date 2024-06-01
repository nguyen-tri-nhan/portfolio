import dotenv from 'dotenv';

dotenv.config();

const RAW_GITHUB_URL = "https://raw.githubusercontent.com";
const GITHUB_USERNAME = process.env.GITHUB_USERNAME;
const GITHUB_REPO = process.env.GITHUB_REPO;
const GITHUB_BRANCH = process.env.GITHUB_BRANCH;

export const repoUrl = `${RAW_GITHUB_URL}/${GITHUB_USERNAME}/${GITHUB_REPO}/${GITHUB_BRANCH}`;