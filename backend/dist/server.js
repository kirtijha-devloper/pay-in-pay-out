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
const notification_routes_1 = __importDefault(require("./routes/notification.routes"));
const branchxPayoutSync_1 = require("./jobs/branchxPayoutSync");
const uploads_1 = require("./lib/uploads");
const runtimeSchema_service_1 = require("./services/runtimeSchema.service");
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 5000;
const defaultAllowedOrigins = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'https://pay-in-pay-out.vercel.app',
    'https://rentsoftpro.com',
    'https://www.rentsoftpro.com',
];
const configuredAllowedOrigins = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
const allowedOrigins = new Set([...defaultAllowedOrigins, ...configuredAllowedOrigins]);
app.use((0, cors_1.default)({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.has(origin)) {
            callback(null, true);
            return;
        }
        callback(new Error(`CORS origin not allowed: ${origin}`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));
app.use((req, res, next) => {
    const requestOrigin = req.headers.origin;
    if (requestOrigin && allowedOrigins.has(requestOrigin)) {
        res.header('Access-Control-Allow-Origin', requestOrigin);
    }
    res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    res.header('Access-Control-Allow-Credentials', 'true');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
app.use('/uploads', express_1.default.static((0, uploads_1.getUploadRoot)()));
// Routes
app.use('/api/auth', auth_routes_1.default);
app.use('/api/users', user_routes_1.default);
app.use('/api/services', service_routes_1.default);
app.use('/api/commissions', commission_routes_1.default);
app.use('/api/reports', report_routes_1.default);
app.use('/api/notifications', notification_routes_1.default);
app.use('/api/payment/v2/payout/callback', branchx_routes_1.default);
// API Health Check
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', message: 'payverse API is running', timestamp: new Date() });
});
// Serve Frontend static files only in non-production
if (process.env.NODE_ENV !== 'production') {
    const frontendDistPath = path_1.default.join(__dirname, '../../frontend/dist');
    app.use(express_1.default.static(frontendDistPath));
    app.use((req, res, next) => {
        if (!req.path.startsWith('/api')) {
            res.sendFile(path_1.default.join(frontendDistPath, 'index.html'), (err) => {
                if (err)
                    next();
            });
        }
        else {
            next();
        }
    });
}
// For Vercel, we export the app. For local development, we call listen.
const bootServer = async () => {
    try {
        if (process.env.NODE_ENV !== 'production') {
            await (0, runtimeSchema_service_1.ensureRuntimeSchema)();
            // Only start background jobs in local development
            (0, branchxPayoutSync_1.startBranchxPayoutSyncJob)();
        }
    }
    catch (error) {
        console.error('Server initialization error:', error);
    }
};
if (process.env.NODE_ENV !== 'production') {
    bootServer();
    app.listen(PORT, () => {
        console.log(`✅ payverse server running on http://localhost:${PORT}`);
    });
}
else {
    console.log('🚀 Serverless function initialized');
}
exports.default = app;
