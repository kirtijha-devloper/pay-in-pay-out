import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import {
  getCompanyBankAccounts,
  getBankVerificationFee,
  getVerifiedBankBeneficiaries,
  upsertCompanyBankAccount,
  toggleCompanyBankAccount,
  submitFundRequest,
  approveFundRequest,
  rejectFundRequest,
  updateBankVerificationFee,
  verifyBankCached,
  getPayoutQuote,
  submitPayout,
  getServiceRequests,
} from '../controllers/service.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();
router.use(authenticate);

const storage = multer.diskStorage({
  destination: 'uploads/',
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

const upload = multer({
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

router.get('/', getServiceRequests);
router.get('/bank-accounts', getCompanyBankAccounts);
router.post('/bank-accounts', authorize('ADMIN'), upsertCompanyBankAccount);
router.put('/bank-accounts', authorize('ADMIN'), upsertCompanyBankAccount);
router.patch('/bank-accounts/:id/toggle', authorize('ADMIN'), toggleCompanyBankAccount);
router.post('/fund-request', authorize('SUPER', 'DISTRIBUTOR', 'RETAILER'), upload.single('receipt'), submitFundRequest);
router.patch('/fund-request/:id/approve', authorize('ADMIN', 'SUPER'), approveFundRequest);
router.patch('/fund-request/:id/reject', authorize('ADMIN', 'SUPER'), rejectFundRequest);
router.get('/bank-verify/fee', getBankVerificationFee);
router.patch('/bank-verify/fee', authorize('ADMIN'), updateBankVerificationFee);
router.get('/bank-verify/beneficiaries', getVerifiedBankBeneficiaries);
router.post('/bank-verify', verifyBankCached);
router.get('/payout/quote', getPayoutQuote);
router.get('/payout/beneficiaries', getVerifiedBankBeneficiaries);
router.post('/payout', submitPayout);

export default router;
