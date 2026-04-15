"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const user_controller_1 = require("../controllers/user.controller");
const auth_controller_1 = require("../controllers/auth.controller");
const auth_1 = require("../middleware/auth");
const storage = multer_1.default.diskStorage({
    destination: 'uploads/',
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${file.originalname}`);
    },
});
const upload = (0, multer_1.default)({ storage });
const router = (0, express_1.Router)();
router.use(auth_1.authenticate);
router.post('/', (0, auth_1.authorize)('ADMIN', 'SUPER', 'DISTRIBUTOR'), upload.fields([
    { name: 'aadhaarFront', maxCount: 1 },
    { name: 'aadhaarBack', maxCount: 1 },
    { name: 'panCard', maxCount: 1 },
]), user_controller_1.createUser);
router.get('/', user_controller_1.getUsers);
router.get('/:id', user_controller_1.getUserById);
router.patch('/profile', user_controller_1.updateProfile);
router.patch('/:id', (0, auth_1.authorize)('ADMIN', 'SUPER', 'DISTRIBUTOR'), user_controller_1.updateUser);
router.patch('/:id/toggle', (0, auth_1.authorize)('ADMIN', 'SUPER', 'DISTRIBUTOR'), user_controller_1.toggleUserStatus);
router.post('/:id/login-as', (0, auth_1.authorize)('ADMIN'), (req, res) => {
    req.body = { ...req.body, userId: req.params.id };
    (0, auth_controller_1.loginAs)(req, res);
});
router.delete('/:id', (0, auth_1.authorize)('ADMIN'), user_controller_1.deleteUser);
exports.default = router;
