// Restrict access to specific roles
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Not authenticated',
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `User role '${req.user.role}' is not authorized to access this route`,
      });
    }

    next();
  };
};

// Check if user is therapist
const isTherapist = (req, res, next) => {
  if (req.user.role !== 'therapist') {
    return res.status(403).json({
      success: false,
      message: 'Access restricted to therapists only',
    });
  }
  next();
};

// Check if user is client
const isClient = (req, res, next) => {
  if (req.user.role !== 'client') {
    return res.status(403).json({
      success: false,
      message: 'Access restricted to clients only',
    });
  }
  next();
};

// Check if user is admin
const isAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Access restricted to administrators only',
    });
  }
  next();
};

// Check if user owns the resource
const isOwner = (resourceUserId) => {
  return (req, res, next) => {
    if (req.user._id.toString() !== resourceUserId.toString() && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to access this resource',
      });
    }
    next();
  };
};

module.exports = {
  authorize,
  isTherapist,
  isClient,
  isAdmin,
  isOwner,
};

