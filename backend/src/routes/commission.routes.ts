import { Router } from 'express';
import {
  deleteSlab,
  deleteUserOverride,
  getEffectiveCommissionSlabs,
  getOverrideTargets,
  getSlabs,
  getUserOverrides,
  upsertSlab,
  upsertUserOverride,
} from '../controllers/commission.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/effective', getEffectiveCommissionSlabs);
router.get('/slabs', authorize('ADMIN', 'SUPER', 'DISTRIBUTOR'), getSlabs);
router.post('/slabs', authorize('ADMIN', 'SUPER', 'DISTRIBUTOR'), upsertSlab);
router.put('/slabs', authorize('ADMIN', 'SUPER', 'DISTRIBUTOR'), upsertSlab);
router.delete('/slabs/:id', authorize('ADMIN', 'SUPER', 'DISTRIBUTOR'), deleteSlab);
router.get('/targets', authorize('ADMIN', 'SUPER', 'DISTRIBUTOR'), getOverrideTargets);
router.get('/overrides', authorize('ADMIN', 'SUPER', 'DISTRIBUTOR'), getUserOverrides);
router.post('/overrides', authorize('ADMIN', 'SUPER', 'DISTRIBUTOR'), upsertUserOverride);
router.put('/overrides', authorize('ADMIN', 'SUPER', 'DISTRIBUTOR'), upsertUserOverride);
router.delete('/overrides/:id', authorize('ADMIN', 'SUPER', 'DISTRIBUTOR'), deleteUserOverride);

export default router;
