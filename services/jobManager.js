const fs = require('fs');
const path = require('path');

class JobManager {
  constructor() {
    // In-Memory store mapping uuid -> Job Object
    this.jobs = new Map();
    // Cache of processed Meta message IDs (wamid) for idempotency
    this.processedMessageIds = new Set();
    // 15 Minutes TTL in milliseconds
    this.TTL_MS = 15 * 60 * 1000;

    // Start background sweep every 5 minutes to purge expired jobs & orphaned temp files
    this.cleanupInterval = setInterval(() => this.sweepExpiredJobs(), 5 * 60 * 1000);
  }

  /**
   * Creates a new delivery job.
   * Status starts as 'WAITING_FOR_USER_SEND'.
   */
  createJob({ uuid, filePath, originalName, fileSize }) {
    if (this.jobs.has(uuid)) {
      throw new Error('DUPLICATE_UUID');
    }

    const now = Date.now();
    const job = {
      uuid,
      filePath,
      originalName,
      fileSize,
      status: 'WAITING_FOR_USER_SEND', // States: WAITING_FOR_USER_SEND, SENDING_VIDEO, DELIVERED, EXPIRED, FAILED
      createdAt: now,
      expiresAt: now + this.TTL_MS,
      customerPhone: null,
      mediaId: null,
      deliveredAt: null,
      error: null,
    };

    this.jobs.set(uuid, job);
    return job;
  }

  /**
   * Retrieves a job by UUID. Automatically checks expiry.
   */
  getJob(uuid) {
    const job = this.jobs.get(uuid);
    if (!job) return null;

    if (Date.now() > job.expiresAt && job.status === 'WAITING_FOR_USER_SEND') {
      this.expireJob(job);
      return null;
    }
    return job;
  }

  /**
   * Atomic claim: Ensures only one webhook handler processes the job.
   * Transitions status from 'WAITING_FOR_USER_SEND' to 'SENDING_VIDEO'.
   */
  claimJobForSending(uuid, customerPhone) {
    const job = this.getJob(uuid);
    if (!job) return null;

    if (job.status !== 'WAITING_FOR_USER_SEND') {
      return null; // Already claimed, sending, or delivered
    }

    job.status = 'SENDING_VIDEO';
    job.customerPhone = customerPhone;
    job.claimedAt = Date.now();
    return job;
  }

  /**
   * Marks a job as fully delivered and unlinks the temporary video immediately.
   */
  markDelivered(uuid) {
    const job = this.jobs.get(uuid);
    if (!job) return;

    job.status = 'DELIVERED';
    job.deliveredAt = Date.now();
    this.unlinkFileSafe(job.filePath);
  }

  /**
   * Marks a job as failed and frees the file.
   */
  markFailed(uuid, errorReason) {
    const job = this.jobs.get(uuid);
    if (!job) return;

    job.status = 'FAILED';
    job.error = errorReason;
    this.unlinkFileSafe(job.filePath);
  }

  /**
   * Idempotency Check: Returns true if wamid was already processed.
   */
  isMessageProcessed(wamid) {
    if (this.processedMessageIds.has(wamid)) {
      return true;
    }
    this.processedMessageIds.add(wamid);
    // Cap the set size to prevent memory leaks (keep last 10,000 IDs)
    if (this.processedMessageIds.size > 10000) {
      const first = this.processedMessageIds.values().next().value;
      this.processedMessageIds.delete(first);
    }
    return false;
  }

  expireJob(job) {
    job.status = 'EXPIRED';
    this.unlinkFileSafe(job.filePath);
    this.jobs.delete(job.uuid);
  }

  unlinkFileSafe(filePath) {
    if (filePath && fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
        console.log(`[JobManager] Safely deleted temporary file: ${filePath}`);
      } catch (err) {
        console.error(`[JobManager] Failed to unlink file ${filePath}:`, err.message);
      }
    }
  }

  sweepExpiredJobs() {
    const now = Date.now();
    for (const [uuid, job] of this.jobs.entries()) {
      if (now > job.expiresAt) {
        console.log(`[JobManager] Sweeping expired job ${uuid}`);
        this.expireJob(job);
      }
    }
  }
}

// Export Singleton Instance
module.exports = new JobManager();
