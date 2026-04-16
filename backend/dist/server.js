"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
const branchx_routes_1 = __importDefault(require("./routes/branchx.routes"));
const user_routes_1 = __importDefault(require("./routes/user.routes"));
const service_routes_1 = __importDefault(require("./routes/service.routes"));
const commission_routes_1 = __importDefault(require("./routes/commission.routes"));
const report_routes_1 = __importDefault(require("./routes/report.routes"));
const branchxPayoutSync_1 = require("./jobs/branchxPayoutSync");
const runtimeSchema_service_1 = require("./services/runtimeSchema.service");
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 5000;
app.use((0, cors_1.default)({ origin: '*', credentials: true }));
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
app.use('/uploads', express_1.default.static(path_1.default.join(__dirname, '../uploads')));
// Routes
app.use('/api/auth', auth_routes_1.default);
app.use('/api/users', user_routes_1.default);
app.use('/api/services', service_routes_1.default);
app.use('/api/commissions', commission_routes_1.default);
app.use('/api/reports', report_routes_1.default);
app.use('/api/payment/v2/payout/callback', branchx_routes_1.default);
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', message: 'AbheePay API is running', timestamp: new Date() });
});
async function bootServer() {
    await (0, runtimeSchema_service_1.ensureRuntimeSchema)();
    (0, branchxPayoutSync_1.startBranchxPayoutSyncJob)();
    app.listen(PORT, () => {
        console.log(`✅ AbheePay server running on http://localhost:${PORT}`);
    });
}
bootServer().catch((error) => {
    console.error('Failed to start server', error);
    process.exit(1);
});
