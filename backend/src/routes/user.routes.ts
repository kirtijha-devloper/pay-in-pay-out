import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import {
  createUser,
  getUsers,
  getUserById,
  toggleUserStatus,
  updateUser,
  updateProfile,
  deleteUser,
  updateKycStatus,
} from '../controllers/user.controller';
import { loginAs } from '../controllers/auth.controller';
import { authenticate, authorize } from '../middleware/auth';

const storage = multer.diskStorage({
  destination: 'uploads/',
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});
const upload = multer({ storage });

const router = Router();

router.use(authenticate);

router.post(
  '/',
  authorize('ADMIN', 'SUPER', 'DISTRIBUTOR'),
  upload.fields([
    { name: 'aadhaarFront', maxCount: 1 },
    { name: 'aadhaarBack', maxCount: 1 },
    { name: 'panCard', maxCount: 1 },
  ]),
  createUser
);
router.get('/', getUsers);
router.get('/:id', getUserById);
router.patch('/profile', updateProfile);
router.patch('/:id', authorize('ADMIN', 'SUPER', 'DISTRIBUTOR'), updateUser);
router.patch('/:id/toggle', authorize('ADMIN', 'SUPER', 'DISTRIBUTOR'), toggleUserStatus);
router.post('/:id/login-as', authorize('ADMIN'), (req, res) => {
  (req as any).body = { ...(req as any).body, userId: req.params.id };
  loginAs(req, res);
});
router.patch('/:id/kyc', authorize('ADMIN'), updateKycStatus);
router.delete('/:id', authorize('ADMIN'), deleteUser);

export default router;
