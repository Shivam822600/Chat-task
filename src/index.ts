import 'dotenv/config';
import express from 'express';
import chatRoutes from './routes/chat';
import userRoutes from './routes/user';
import { errorHandler } from './errors';

const app = express();
app.use(express.json());

app.use('/chat', chatRoutes);
app.use('/user', userRoutes);
app.use('/users', userRoutes);

app.use((_req, res) => {
  res.status(404).json({ error: 'not found' });
});
app.use(errorHandler);

const port = Number(process.env.PORT) || 3000;
app.listen(port, () => console.log(`server running on port ${port}`));
