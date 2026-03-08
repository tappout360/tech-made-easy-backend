const { validationResult } = require('express-validator');

/**
 * Centralized validation error handler middleware.
 * Place after express-validator check chains in route definitions.
 * Returns structured 400 errors with field-level detail.
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      msg: 'Validation failed',
      errors: errors.array().map((e) => ({
        field: e.path,
        message: e.msg,
      })),
    });
  }
  next();
};

module.exports = { handleValidationErrors };
