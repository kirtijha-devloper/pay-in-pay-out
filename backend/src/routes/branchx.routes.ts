import { Router } from 'express';
import { handleBranchxPayoutCallback } from '../controllers/branchx.controller';

const router = Router();

router.route('/').get(handleBranchxPayoutCallback).post(handleBranchxPayoutCallback);

export default router;
