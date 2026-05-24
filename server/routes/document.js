const express = require('express');
const router = express.Router();
const multer = require('multer');
const { parseDates } = require('../controllers/document');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype !== 'application/pdf') return cb(new Error('PDF only'));
    cb(null, true);
  }
});

router.post('/upload', upload.array('syllabi', 10), parseDates);

module.exports = router;