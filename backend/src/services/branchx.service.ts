type BranchxStatus = 'SUCCESS' | 'PENDING' | 'FAILED';

export type BranchxPayoutInput = {
  amount: number;
  mobileNumber: string;
  requestId: string;
  accountNumber: string;
  ifscCode: string;
  beneficiaryName: string;
  remitterName: string;
  bankName: string;
  transferMode: string;
  latitude: string;
  longitude: string;
  emailId: string;
  purpose?: string;
};

export type BranchxServiceResult = {
  success: boolean;
  status: BranchxStatus;
  statusCode: string;
  message: string;
  requestId: string;
  httpStatus: number;
  raw: any;
};

function normalizeText(value: unknown) {
  return String(value ?? '').trim();
}

function maskAccountNumber(value: string) {
  if (!value) return '';
  if (value.length <= 4) return '****';
  return `${'*'.repeat(value.length - 4)}${value.slice(-4)}`;
}

function maskMobileNumber(value: string) {
  if (!value) return '';
  if (value.length <= 2) return '**';
  return `${value.slice(0, 2)}${'*'.repeat(Math.max(value.length - 4, 0))}${value.slice(-2)}`;
}

function redactBranchxObject(input: any): any {
  if (!input || typeof input !== 'object') return input;

  if (Array.isArray(input)) {
    return input.map((item) => redactBranchxObject(item));
  }

  const output: Record<string, any> = {};
  for (const [key, value] of Object.entries(input)) {
    const lowerKey = key.toLowerCase();

    if (lowerKey.includes('token') || lowerKey.includes('secret') || lowerKey.includes('auth')) {
      output[key] = '[REDACTED]';
      continue;
    }

    if (lowerKey.includes('account')) {
      output[key] = typeof value === 'string' ? maskAccountNumber(value) : value;
      continue;
    }

    if (lowerKey.includes('mobile') || lowerKey.includes('phone')) {
      output[key] = typeof value === 'string' ? maskMobileNumber(value) : value;
      continue;
    }

    output[key] = redactBranchxObject(value);
  }

  return output;
}

function getBranchxConfig() {
  const baseUrl = normalizeText(process.env.BRANCHX_BASE_URL) || 'https://10x.api.branchx.in';
  const payoutEndpoint = normalizeText(process.env.BRANCHX_PAYOUT_ENDPOINT) || '/service/payout/v2';
  const statusCheckEndpoint = normalizeText(process.env.BRANCHX_STATUS_CHECK_ENDPOINT) || '/service/status_check/v2';
  const apiToken = normalizeText(process.env.BRANCHX_API_TOKEN);
  const timeoutMs = Number(process.env.BRANCHX_TIMEOUT_MS || 60000);

  return {
    baseUrl,
    payoutEndpoint,
    statusCheckEndpoint,
    apiToken,
    timeoutMs: Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 60000,
  };
}

export function isBranchxConfigured() {
  const config = getBranchxConfig();
  return Boolean(config.baseUrl && config.payoutEndpoint && config.statusCheckEndpoint && config.apiToken);
}

function buildUrl(endpoint: string) {
  const { baseUrl } = getBranchxConfig();
  if (!baseUrl || !endpoint) {
    throw new Error('BranchX payout is not configured');
  }

  return new URL(endpoint, baseUrl).toString();
}

function buildHeaders() {
  const { apiToken } = getBranchxConfig();
  if (!apiToken) {
    throw new Error('BranchX API token is not configured');
  }

  return {
    'Content-Type': 'application/json',
    apiToken,
  };
}

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

function parseBody(text: string) {
  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

function extractStatusCode(payload: any) {
  return String(
    payload?.statuscode ??
      payload?.statusCode ??
      payload?.data?.statuscode ??
      payload?.data?.statusCode ??
      ''
  ).trim();
}

function extractMessage(payload: any) {
  return String(
    payload?.message ??
      payload?.msg ??
      payload?.statusdesc ??
      payload?.data?.message ??
      payload?.data?.statusdesc ??
      ''
  ).trim();
}

export function normalizeBranchxStatus(payload: any): BranchxStatus {
  const status = String(
    payload?.status ??
      payload?.Status ??
      payload?.data?.status ??
      payload?.data?.Status ??
      ''
  )
    .trim()
    .toUpperCase();

  const statusCode = extractStatusCode(payload).toUpperCase();

  if (['SUCCESS', 'COMPLETED'].includes(status)) {
    return 'SUCCESS';
  }

  if (['FAILED', 'FAILURE', 'REJECTED', 'CANCELLED', 'REVERSED', 'REFUND'].includes(status)) {
    return 'FAILED';
  }

  if (['PENDING', 'PROCESSING', 'IN_PROGRESS', 'TUP', 'ACCEPTED'].includes(status)) {
    return 'PENDING';
  }

  if (!status && (statusCode === 'TXN' || ['SUCCESS', 'COMPLETED'].includes(statusCode))) {
    return 'SUCCESS';
  }

  if (!status && ['FAILED', 'FAILURE', 'REJECTED', 'CANCELLED', 'REVERSED', 'REFUND'].includes(statusCode)) {
    return 'FAILED';
  }

  if (!status && ['PENDING', 'PROCESSING', 'IN_PROGRESS', 'TUP', 'ACCEPTED', '200', 'OK'].includes(statusCode)) {
    return 'PENDING';
  }

  if (['400', '401', '403', '404', '422', '500'].includes(statusCode)) {
    return 'FAILED';
  }

  return 'PENDING';
}

export async function submitBranchxPayout(input: BranchxPayoutInput): Promise<BranchxServiceResult> {
  const { payoutEndpoint, timeoutMs } = getBranchxConfig();
  const url = buildUrl(payoutEndpoint);
  const payload = {
    amount: Number(input.amount || 0),
    mobileNumber: normalizeText(input.mobileNumber),
    requestId: normalizeText(input.requestId),
    accountNumber: normalizeText(input.accountNumber),
    ifscCode: normalizeText(input.ifscCode).toUpperCase(),
    beneficiaryName: normalizeText(input.beneficiaryName),
    remitterName: normalizeText(input.remitterName),
    bankName: normalizeText(input.bankName),
    transferMode: normalizeText(input.transferMode).toUpperCase() || 'IMPS',
    latitude: normalizeText(input.latitude) || '0',
    longitude: normalizeText(input.longitude) || '0',
    emailId: normalizeText(input.emailId),
    purpose: normalizeText(input.purpose) || 'Payout',
  };

  console.info(
    '[BranchX] payout_request',
    JSON.stringify({
      url,
      requestId: payload.requestId,
      payload: redactBranchxObject(payload),
    })
  );

  const response = await fetchWithTimeout(
    url,
    {
      method: 'POST',
      headers: buildHeaders(),
      body: JSON.stringify(payload),
    },
    timeoutMs
  );

  const responseText = await response.text();
  const raw = parseBody(responseText);
  const status = normalizeBranchxStatus(raw);
  const message = extractMessage(raw) || (response.ok ? 'BranchX payout request accepted' : `BranchX payout request failed with HTTP ${response.status}`);
  const statusCode = extractStatusCode(raw) || String(response.status);

  console.info(
    '[BranchX] payout_response',
    JSON.stringify({
      url,
      requestId: payload.requestId,
      httpStatus: response.status,
      status,
      statusCode,
      message,
      response: redactBranchxObject(raw),
    })
  );

  if (!response.ok) {
    const error = new Error(message || `BranchX payout request failed with HTTP ${response.status}`);
    (error as any).statusCode = response.status;
    (error as any).providerResponse = raw;
    throw error;
  }

  return {
    success: true,
    status,
    statusCode,
    message,
    requestId: payload.requestId,
    httpStatus: response.status,
    raw,
  };
}

export async function checkBranchxPayoutStatus(requestId: string): Promise<BranchxServiceResult> {
  const { statusCheckEndpoint, timeoutMs } = getBranchxConfig();
  const url = buildUrl(statusCheckEndpoint);
  const payload = { requestId: normalizeText(requestId) };

  console.info(
    '[BranchX] payout_status_request',
    JSON.stringify({
      url,
      requestId: payload.requestId,
      payload: redactBranchxObject(payload),
    })
  );

  const response = await fetchWithTimeout(
    url,
    {
      method: 'POST',
      headers: buildHeaders(),
      body: JSON.stringify(payload),
    },
    timeoutMs
  );

  const responseText = await response.text();
  const raw = parseBody(responseText);
  const status = normalizeBranchxStatus(raw);
  const message = extractMessage(raw) || (response.ok ? 'BranchX payout status fetched' : `BranchX status check failed with HTTP ${response.status}`);
  const statusCode = extractStatusCode(raw) || String(response.status);

  console.info(
    '[BranchX] payout_status_response',
    JSON.stringify({
      url,
      requestId: payload.requestId,
      httpStatus: response.status,
      status,
      statusCode,
      message,
      response: redactBranchxObject(raw),
    })
  );

  if (!response.ok) {
    const error = new Error(message || `BranchX status check failed with HTTP ${response.status}`);
    (error as any).statusCode = response.status;
    (error as any).providerResponse = raw;
    throw error;
  }

  return {
    success: true,
    status,
    statusCode,
    message,
    requestId: payload.requestId,
    httpStatus: response.status,
    raw,
  };
}
