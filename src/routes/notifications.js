const express = require('express');
const router = express.Router();
const { getNotifications } = require('../controllers/notificationsController');
const { protect } = require('../middlewares/auth');

router.use(protect);

router.get('/', getNotifications);

module.exports = router;
