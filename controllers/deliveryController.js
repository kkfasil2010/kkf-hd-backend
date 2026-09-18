const path = require('path');
const fs = require('fs');
const multer = require('multer');
const jobManager = require('../services/jobManager');

// Ensure temp directory exists
const tempDir = path.join(__dirname, '../temp');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

// Multer DiskStorage with secure randomized filename
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, tempDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `video-${uniqueSuffix}.mp4`);
  }
});

// Strict File Filter: 16 MiB max, video/mp4 and video/3gp only
const upload = multer({
  storage,
  limits: { fileSize: 16 * 1024 * 1024 }, // 16 MiB strict limit
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['video/mp4', 'video/3gp', 'video/quicktime'];
    if (allowedMimes.includes(file.mimetype) || file.originalname.endsWith('.mp4')) {
      cb(null, true);
    } else {
      cb(new Error('INVALID_FILE_TYPE'));
    }
  }
}).single('video');

// Controller Handlers
exports.uploadMiddleware = upload;

exports.createDeliveryJob = (req, res) => {
  try {
    const { uuid } = req.body;
    const file = req.file;

    if (!uuid || !file) {
      // If file was uploaded but uuid was missing, clean up immediately
      if (file) fs.unlinkSync(file.path);
      return res.status(400).json({ error: 'MISSING_UUID_OR_VIDEO' });
    }

    // Register in JobManager
    const job = jobManager.createJob({
      uuid,
      filePath: file.path,
      originalName: file.originalname,
      fileSize: file.size,
    });

    const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID || '';
    const businessPhone = process.env.WHATSAPP_BUSINESS_PHONE_NUMBER || '15552006793';
    const prefilledText = `*Please CLICK SEND to get your HD Video!*\n\n${uuid}`;
    const clickToSendUrl = `https://wa.me/${businessPhone}?text=${encodeURIComponent(prefilledText)}`;

    return res.status(200).json({
      success: true,
      uuid: job.uuid,
      status: job.status,
      expiresAt: job.expiresAt,
      clickToSendUrl
    });
  } catch (err) {
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    if (err.message === 'DUPLICATE_UUID') {
      return res.status(409).json({ error: 'DUPLICATE_UUID_ALREADY_EXISTS' });
    }
    return res.status(500).json({ error: err.message });
  }
};

exports.getDeliveryStatus = (req, res) => {
  const { uuid } = req.params;
  const job = jobManager.getJob(uuid);

  if (!job) {
    return res.status(404).json({ error: 'JOB_NOT_FOUND_OR_EXPIRED' });
  }

  return res.status(200).json({
    uuid: job.uuid,
    status: job.status,
    createdAt: job.createdAt,
    expiresAt: job.expiresAt,
    deliveredAt: job.deliveredAt || null,
    error: job.error || null,
  });
};
