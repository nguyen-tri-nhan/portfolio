import { repoUrl } from "./repoHelper";

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
