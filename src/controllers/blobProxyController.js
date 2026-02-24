const { asyncHandler } = require('../middlewares/errorHandler');
const { Readable } = require('stream');

/**
 * @desc    Proxy a private Vercel Blob URL — streams the file to the client
 * @route   GET /api/blob/proxy?url=<encoded-blob-url>
 * @access  Public (URL-validated — only our blob store domain is allowed)
 */
const proxyBlobFile = asyncHandler(async (req, res) => {
    const { url } = req.query;

    if (!url) {
        return res.status(400).json({
            success: false,
            message: 'Missing "url" query parameter',
        });
    }

    // Security: Only allow URLs from our Vercel Blob store
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

    try {
        // Fetch the file from Vercel Blob with the server-side token
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

        // Forward content-type and content-disposition headers
        const contentType = response.headers.get('content-type');
        const contentDisposition = response.headers.get('content-disposition');
        const contentLength = response.headers.get('content-length');

        if (contentType) res.setHeader('Content-Type', contentType);
        if (contentDisposition) res.setHeader('Content-Disposition', contentDisposition);
        if (contentLength) res.setHeader('Content-Length', contentLength);

        // Allow browser caching for 1 hour
        res.setHeader('Cache-Control', 'private, max-age=3600');
        // Allow cross-origin image loading
        res.setHeader('Access-Control-Allow-Origin', '*');

        // Convert the web ReadableStream to a Node.js Readable and pipe it
        if (response.body && typeof response.body.pipe === 'function') {
            // Node.js native fetch returns a web stream — convert via Readable.fromWeb
            response.body.pipe(res);
        } else if (response.body && typeof response.body.getReader === 'function') {
            // Web stream with getReader
            const nodeStream = Readable.fromWeb(response.body);
            nodeStream.pipe(res);
        } else {
            // Fallback: read entire body as buffer
            const buffer = Buffer.from(await response.arrayBuffer());
            res.end(buffer);
        }
    } catch (error) {
        console.error('Blob proxy error:', error.message);
        if (!res.headersSent) {
            res.status(500).json({
                success: false,
                message: 'Failed to proxy blob file',
            });
        }
    }
});

module.exports = { proxyBlobFile };
