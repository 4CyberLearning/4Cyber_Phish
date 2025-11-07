import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import authRoutes from './routes/auth.js'
import campaignRoutes from './routes/campaigns.js'

dotenv.config();
const app = express();
const prisma = new PrismaClient();
app.use(cors());
app.use(express.json());
app.use('/api', authRoutes)
app.use('/api', campaignRoutes)
app.get('/api/health', (_req,res)=>res.json({ ok:true }))


app.listen(process.env.PORT || 5000, () =>
  console.log('✅ Backend running at http://localhost:5000')
);
