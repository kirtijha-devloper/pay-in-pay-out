import { Router } from 'express';
import { getSlabs, upsertSlab, deleteSlab, getUserOverrides, setUserOverride } from '../controllers/commission.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/slabs', getSlabs);
router.post('/slabs', authorize('ADMIN'), upsertSlab);
router.put('/slabs', authorize('ADMIN'), upsertSlab);
router.delete('/slabs/:id', authorize('ADMIN'), deleteSlab);
router.get('/overrides', getUserOverrides);
router.post('/overrides', authorize('ADMIN', 'SUPER', 'DISTRIBUTOR'), setUserOverride);

export default router;
