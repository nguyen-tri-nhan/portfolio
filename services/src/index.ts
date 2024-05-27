import express, { Request, Response } from 'express';
import axios from 'axios';
import dotenv from 'dotenv';

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



app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
