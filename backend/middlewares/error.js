const logger = require('../logger');

function errorHandler(err, req, res, next) {
    logger.error({
        message: err.message,
        stack: err.stack,
        url: req.originalUrl,
        method: req.method,
        user: req.user?.id,
    });

    // Default error
    const statusCode = err.statusCode || 500;
    const message = process.env.NODE_ENV === 'production'
        ? 'Internal Server Error'
        : err.message;

    res.status(statusCode).json({
        error: {
            status: statusCode,
            message,
            ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
        },
    });
}

module.exports = { errorHandler };