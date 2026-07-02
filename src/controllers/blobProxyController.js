const { asyncHandler } = require('../middlewares/errorHandler');

const proxyBlobFile = asyncHandler(async (req, res) => {
    const { url } = req.query;

    if (!url) {
        return res.status(400).json({
            success: false,
            message: 'Missing "url" query parameter',
        });
    }

    const allowedHost = 'blob.vercel-storage.com';
    let parsedUrl;
    try {
        parsedUrl = new URL(url);
    } catch {
        return res.status(400).json({
            success: false,
            message: 'Invalid URL',
        });
    }

    if (!parsedUrl.hostname.endsWith(allowedHost)) {
        return res.status(403).json({
            success: false,
            message: 'URL not allowed — only Vercel Blob URLs are supported',
        });
    }

    const response = await fetch(url, {
        headers: {
            Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}`,
        },
    });

    if (!response.ok) {
        return res.status(response.status).json({
            success: false,
            message: `Failed to fetch blob: ${response.statusText}`,
        });
    }

    const buffer = Buffer.from(await response.arrayBuffer());

    const contentType = response.headers.get('content-type');
    if (contentType) res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Length', buffer.length);
    res.setHeader('Cache-Control', 'private, max-age=3600');

    res.end(buffer);
});

module.exports = { proxyBlobFile };
