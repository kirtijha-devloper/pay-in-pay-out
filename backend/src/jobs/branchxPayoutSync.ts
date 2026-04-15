import { isBranchxConfigured } from '../services/branchx.service';
import { syncPendingPayouts } from '../services/payout.service';

let jobStarted = false;
let jobRunning = false;

export function startBranchxPayoutSyncJob() {
  if (jobStarted) {
    return;
  }

  jobStarted = true;

  if (!isBranchxConfigured()) {
    console.warn('[BranchX] payout settlement job is disabled because configuration is incomplete');
    return;
  }

  const intervalMs = Number(process.env.BRANCHX_PAYOUT_SYNC_INTERVAL_MS || 5 * 60 * 1000);
  const initialDelayMs = Number(process.env.BRANCHX_PAYOUT_SYNC_INITIAL_DELAY_MS || 60 * 1000);

  const runJob = async () => {
    if (jobRunning) {
      return;
    }

    jobRunning = true;
    try {
      await syncPendingPayouts();
    } catch (error) {
      console.error('[BranchX] payout settlement job failed', error);
    } finally {
      jobRunning = false;
    }
  };

  setTimeout(runJob, initialDelayMs);
  setInterval(runJob, intervalMs);
}
