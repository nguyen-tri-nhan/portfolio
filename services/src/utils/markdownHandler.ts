import dotenv from 'dotenv';

dotenv.config();

const RAW_GITHUB_URL = "https://raw.githubusercontent.com";
const GITHUB_USERNAME = process.env.GITHUB_USERNAME;
const GITHUB_REPO = process.env.GITHUB_REPO;
const GITHUB_BRANCH = process.env.GITHUB_BRANCH;

const repoUrl = `${RAW_GITHUB_URL}/${GITHUB_USERNAME}/${GITHUB_REPO}/${GITHUB_BRANCH}`;


export function resolveImagePaths(markdown: string): string {
  // Regex to find image paths in markdown
  const imagePathRegex = /!\[.*?\]\((.*?)\)/g;

  return markdown.replace(imagePathRegex, (match, p1) => {
    // Check if the path is relative
    if (p1.startsWith("http")) {
      return match;
    }
    // Construct the absolute URL for the image
    const absoluteUrl = `${repoUrl}/${p1.replace("../", "")}`;
    return match.replace(p1, absoluteUrl);
  });
}
