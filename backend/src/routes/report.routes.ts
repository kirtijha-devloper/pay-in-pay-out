import { Router } from 'express';
import { getDashboardStats, getLedger, getReport } from '../controllers/report.controller';
import { authenticate } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/dashboard', getDashboardStats);
router.get('/ledger', getLedger);
router.get('/general', getReport);
router.get('/', getReport);

export default router;
