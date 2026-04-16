import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import {
  listBranchxCallbackIps as listBranchxCallbackIpsService,
  processBranchxPayoutCallback,
} from '../services/payout.service';

function normalizeText(value: unknown) {
  return String(value ?? '').trim();
}

function normalizeIp(value: string | undefined | null) {
  const text = normalizeText(value);
  if (!text) {
    return 'unknown';
  }

  return text.replace(/^::ffff:/i, '');
}

function getForwardedForHeader(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value.filter(Boolean).join(', ');
  }

  return normalizeText(value) || null;
}

function getRequestSourceIp(req: Request) {
  const forwardedForHeader = getForwardedForHeader(req.headers['x-forwarded-for']);
  const forwardedForFirst = forwardedForHeader ? forwardedForHeader.split(',')[0]?.trim() : '';
  const directIp = normalizeIp(forwardedForFirst || req.ip || req.socket.remoteAddress || 'unknown');

  return {
    sourceIp: directIp,
    forwardedFor: forwardedForHeader,
  };
}

function getCallbackPayload(req: Request) {
  if (req.method.toUpperCase() === 'GET') {
    return { ...req.query };
  }

  return { ...req.query, ...req.body };
}

export const handleBranchxPayoutCallback = async (req: Request, res: Response) => {
  try {
    const payload = getCallbackPayload(req);
    const result = await processBranchxPayoutCallback(payload, {
      method: req.method,
      ...getRequestSourceIp(req),
      userAgent: normalizeText(req.headers['user-agent']) || null,
    });

    res.status(200).json({
      success: true,
      message: 'BranchX callback received',
      ...result,
    });
  } catch (err) {
    console.error('[BranchX] callback_handler_error', err);
    res.status(500).json({
      success: false,
      message: err instanceof Error ? err.message : 'Server error',
    });
  }
};

export const getBranchxCallbackIps = async (_req: AuthRequest, res: Response) => {
  try {
    const ips = await listBranchxCallbackIpsService();
    res.json({ success: true, ips });
  } catch (err) {
    console.error('[BranchX] callback_ip_lookup_error', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
