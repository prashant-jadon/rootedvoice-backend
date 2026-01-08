const AdminActionLog = require('../models/AdminActionLog');

/**
 * Log an admin action to the audit trail
 * @param {Object} options - Logging options
 * @param {String} options.adminId - ID of the admin performing the action
 * @param {String} options.action - Action type (from enum in AdminActionLog model)
 * @param {String} options.targetType - Type of target (therapist, user, client, system, document)
 * @param {String} options.targetId - ID of the target entity
 * @param {String} options.targetName - Human-readable name for the target
 * @param {Object} options.details - Action-specific details
 * @param {Object} options.metadata - Additional metadata (reason, notes, etc.)
 * @param {String} options.ipAddress - IP address of the admin
 * @param {String} options.userAgent - User agent of the admin
 */
const logAdminAction = async ({
  adminId,
  action,
  targetType,
  targetId,
  targetName = null,
  details = {},
  metadata = {},
  ipAddress = null,
  userAgent = null,
}) => {
  try {
    await AdminActionLog.create({
      adminId,
      action,
      targetType,
      targetId,
      targetName,
      details,
      metadata,
      ipAddress,
      userAgent,
    });
  } catch (error) {
    // Log error but don't throw - we don't want to break the main action
    console.error('Failed to log admin action:', error);
  }
};

/**
 * Get client IP address from request
 */
const getClientIp = (req) => {
  return (
    req.headers['x-forwarded-for']?.split(',')[0] ||
    req.headers['x-real-ip'] ||
    req.connection?.remoteAddress ||
    req.socket?.remoteAddress ||
    'unknown'
  );
};

/**
 * Get user agent from request
 */
const getUserAgent = (req) => {
  return req.headers['user-agent'] || 'unknown';
};

module.exports = {
  logAdminAction,
  getClientIp,
  getUserAgent,
};

