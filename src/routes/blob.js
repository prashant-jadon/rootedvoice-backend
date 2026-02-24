const express = require('express');
const router = express.Router();
const { proxyBlobFile } = require('../controllers/blobProxyController');

// GET /api/blob/proxy?url=<encoded-blob-url>
// No auth required — browser opens these in new tabs (can't send headers).
// Security: only our blob store domain is whitelisted in the controller.
router.get('/proxy', proxyBlobFile);

module.exports = router;
