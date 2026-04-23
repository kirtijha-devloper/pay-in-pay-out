import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import authRoutes from './routes/auth.routes';
import branchxRoutes from './routes/branchx.routes';
import userRoutes from './routes/user.routes';
import serviceRoutes from './routes/service.routes';
import commissionRoutes from './routes/commission.routes';
import reportRoutes from './routes/report.routes';
import { startBranchxPayoutSyncJob } from './jobs/branchxPayoutSync';
import { ensureRuntimeSchema } from './services/runtimeSchema.service';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({ origin: '*', credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/commissions', commissionRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/payment/v2/payout/callback', branchxRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'payverse API is running', timestamp: new Date() });
});

async function bootServer() {
  await ensureRuntimeSchema();
  startBranchxPayoutSyncJob();

  app.listen(PORT, () => {
    console.log(`✅ payverse server running on http://localhost:${PORT}`);
  });
}

bootServer().catch((error) => {
  console.error('Failed to start server', error);
  process.exit(1);
});
