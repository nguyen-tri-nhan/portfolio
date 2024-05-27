import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import { fetchGitHubContent } from './apis/githubApis';
import { GITHUB_BLOG } from './apis/path';

// Load environment variables from .env file
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;


// Middleware to parse JSON
app.use(express.json());

app.get('/', (req: Request, res: Response) => {
  console.log('Hello, world!');
  res.send('Hello, world!');
});

app.get(GITHUB_BLOG, async (req: Request, res: Response) => {
  try {
    fetchGitHubContent('blogs').then((blogs) => {
      res.send(blogs);
    });
  } catch (error: unknown) {
    let message = 'Internal server error';
    if (error instanceof Error) {
      message = error.message;
    } else if (typeof error === 'string') {
      message = error;
    }
    console.error(error);
    res.status(500).send(message);
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
