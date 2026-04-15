import { Router } from 'express';
import {
  submitFundRequest,
  approveFundRequest,
  rejectFundRequest,
  verifyBank,
  submitPayout,
  getServiceRequests,
} from '../controllers/service.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/', getServiceRequests);
router.post('/fund-request', submitFundRequest);
router.patch('/fund-request/:id/approve', authorize('ADMIN', 'SUPER'), approveFundRequest);
router.patch('/fund-request/:id/reject', authorize('ADMIN', 'SUPER'), rejectFundRequest);
router.post('/bank-verify', verifyBank);
router.post('/payout', submitPayout);

export default router;
