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
  approveKycRequest,
  getKycRequests,
  getMyKycRequest,
  rejectKycRequest,
  submitKycRequest,
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
const kycUpload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    const extension = path.extname(file.originalname).toLowerCase();
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.pdf'];

    if (allowedMimeTypes.includes(file.mimetype) || allowedExtensions.includes(extension)) {
      cb(null, true);
      return;
    }

    cb(new Error('Only image or PDF files are allowed'));
  },
  limits: {
    fileSize: 8 * 1024 * 1024,
  },
});

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
router.get('/kyc/request', getMyKycRequest);
router.post('/kyc/request', kycUpload.single('kycPhoto'), submitKycRequest);
router.get('/kyc/requests', authorize('ADMIN'), getKycRequests);
router.patch('/kyc/requests/:id/approve', authorize('ADMIN'), approveKycRequest);
router.patch('/kyc/requests/:id/reject', authorize('ADMIN'), rejectKycRequest);
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
