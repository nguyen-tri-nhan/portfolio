import express, { NextFunction, Request, Response } from "express";
import dotenv from "dotenv";
import { fetchFileContent, fetchGitHubContent } from "./apis/githubApis";
import { GITHUB, GITHUB_FILE } from "./apis/path";
import cors from "cors";

// Load environment variables from .env file
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware to parse JSON
app.use(express.json());

const corsOptions = {
  origin: process.env.CORS_ORIGIN,
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));

app.get(GITHUB, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { category } = req.params;
    fetchGitHubContent(category)
      .then((blogs) => {
        res.send(blogs);
      })
      .catch((err) => {
        throw err;
      });
  } catch (error) {
    return next(error);
  }
});

app.get(GITHUB_FILE, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { category } = req.params;
    const { fileName } = req.query;
    fetchFileContent(`${category}/${fileName}`)
      .then((file) => {
        res.send(file);
      })
      .catch((err) => {
        throw err;
      });
  } catch (error) {
    return next(error);
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
