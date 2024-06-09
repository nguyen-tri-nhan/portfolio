import { SitemapStream, streamToPromise } from "sitemap";
import { createWriteStream } from "fs";

// Define your routes
const links = [
  { url: "/", changefreq: "daily", priority: 1.0 },
  { url: "/#", changefreq: "daily", priority: 1.0 },
  { url: "/#/about", changefreq: "weekly", priority: 0.8 },
  { url: "/#/blogs", changefreq: "weekly", priority: 0.8 },
  { url: "/#/projects", changefreq: "weekly", priority: 0.8 },
  { url: "/assets", changefreq: "weekly", priority: 0.8 },
];

async function generateSitemap() {
  const sitemap = new SitemapStream({
    hostname: "https://nguyen-tri-nhan.github.io/",
  });
  const writeStream = createWriteStream("./public/sitemap.xml");
  sitemap.pipe(writeStream);
  links.forEach((link) => sitemap.write(link));
  sitemap.end();

  try {
    await streamToPromise(sitemap);
    console.log("Sitemap created successfully.");
  } catch (error) {
    console.error("Error creating sitemap:", error);
  }
}

generateSitemap();
