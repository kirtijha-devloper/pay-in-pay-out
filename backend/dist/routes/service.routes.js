"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const service_controller_1 = require("../controllers/service.controller");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.use(auth_1.authenticate);
const storage = multer_1.default.diskStorage({
    destination: 'uploads/',
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${file.originalname}`);
    },
});
const upload = (0, multer_1.default)({
    storage,
    fileFilter: (req, file, cb) => {
        const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
        const extension = path_1.default.extname(file.originalname).toLowerCase();
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
router.get('/', service_controller_1.getServiceRequests);
router.get('/bank-accounts', service_controller_1.getCompanyBankAccounts);
router.post('/bank-accounts', (0, auth_1.authorize)('ADMIN'), service_controller_1.upsertCompanyBankAccount);
router.put('/bank-accounts', (0, auth_1.authorize)('ADMIN'), service_controller_1.upsertCompanyBankAccount);
router.patch('/bank-accounts/:id/toggle', (0, auth_1.authorize)('ADMIN'), service_controller_1.toggleCompanyBankAccount);
router.post('/fund-request', (0, auth_1.authorize)('SUPER', 'DISTRIBUTOR', 'RETAILER'), upload.single('receipt'), service_controller_1.submitFundRequest);
router.patch('/fund-request/:id/approve', (0, auth_1.authorize)('ADMIN', 'SUPER'), service_controller_1.approveFundRequest);
router.patch('/fund-request/:id/reject', (0, auth_1.authorize)('ADMIN', 'SUPER'), service_controller_1.rejectFundRequest);
router.post('/bank-verify', service_controller_1.verifyBank);
router.post('/payout', service_controller_1.submitPayout);
exports.default = router;
