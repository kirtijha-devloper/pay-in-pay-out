"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getBranchxCallbackIps = exports.handleBranchxPayoutCallback = void 0;
const payout_service_1 = require("../services/payout.service");
function normalizeText(value) {
    return String(value ?? '').trim();
}
function normalizeIp(value) {
    const text = normalizeText(value);
    if (!text) {
        return 'unknown';
    }
    return text.replace(/^::ffff:/i, '');
}
function getForwardedForHeader(value) {
    if (Array.isArray(value)) {
        return value.filter(Boolean).join(', ');
    }
    return normalizeText(value) || null;
}
function getRequestSourceIp(req) {
    const forwardedForHeader = getForwardedForHeader(req.headers['x-forwarded-for']);
    const forwardedForFirst = forwardedForHeader ? forwardedForHeader.split(',')[0]?.trim() : '';
    const directIp = normalizeIp(forwardedForFirst || req.ip || req.socket.remoteAddress || 'unknown');
    return {
        sourceIp: directIp,
        forwardedFor: forwardedForHeader,
    };
}
function getCallbackPayload(req) {
    if (req.method.toUpperCase() === 'GET') {
        return { ...req.query };
    }
    return { ...req.query, ...req.body };
}
const handleBranchxPayoutCallback = async (req, res) => {
    try {
        const payload = getCallbackPayload(req);
        const result = await (0, payout_service_1.processBranchxPayoutCallback)(payload, {
            method: req.method,
            ...getRequestSourceIp(req),
            userAgent: normalizeText(req.headers['user-agent']) || null,
        });
        res.status(200).json({
            success: true,
            message: 'BranchX callback received',
            ...result,
        });
    }
    catch (err) {
        console.error('[BranchX] callback_handler_error', err);
        res.status(500).json({
            success: false,
            message: err instanceof Error ? err.message : 'Server error',
        });
    }
};
exports.handleBranchxPayoutCallback = handleBranchxPayoutCallback;
const getBranchxCallbackIps = async (_req, res) => {
    try {
        const ips = await (0, payout_service_1.listBranchxCallbackIps)();
        res.json({ success: true, ips });
    }
    catch (err) {
        console.error('[BranchX] callback_ip_lookup_error', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
exports.getBranchxCallbackIps = getBranchxCallbackIps;
