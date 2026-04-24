"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUploadRoot = getUploadRoot;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const uploadBaseDir = process.env.VERCEL
    ? process.platform === 'win32'
        ? process.env.TEMP || process.env.TMP || process.cwd()
        : '/tmp'
    : process.cwd();
const uploadRoot = path_1.default.join(uploadBaseDir, 'uploads');
function getUploadRoot() {
    if (!fs_1.default.existsSync(uploadRoot)) {
        fs_1.default.mkdirSync(uploadRoot, { recursive: true });
    }
    return uploadRoot;
}
