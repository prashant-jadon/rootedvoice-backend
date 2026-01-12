const { asyncHandler } = require('../middlewares/errorHandler');

// @desc    Get platform stats (public)
// @route   GET /api/public/platform-stats
// @access  Public
const getPlatformStats = asyncHandler(async (req, res) => {
  const PlatformStats = require('../models/PlatformStats');
  const stats = await PlatformStats.getStats();
  
  res.json({
    success: true,
    data: stats,
  });
});

module.exports = {
  getPlatformStats,
};

