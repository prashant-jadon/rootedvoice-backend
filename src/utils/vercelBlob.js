const { put, del } = require('@vercel/blob');

/**
 * Upload a file buffer to Vercel Blob storage.
 * @param {Buffer} buffer - The file buffer (from multer memoryStorage)
 * @param {string} pathname - The desired path/filename in blob storage (e.g. "documents/uuid.pdf")
 * @param {Object} options - Additional options
 * @param {string} options.contentType - MIME type of the file
 * @returns {Promise<{url: string}>} The public URL of the uploaded blob
 */
const uploadToBlob = async (buffer, pathname, options = {}) => {
    const blob = await put(pathname, buffer, {
        contentType: options.contentType || 'application/octet-stream',
        token: process.env.BLOB_READ_WRITE_TOKEN,
    });

    return blob; // { url, pathname, contentType, contentDisposition }
};

/**
 * Delete a file from Vercel Blob storage.
 * @param {string} url - The blob URL to delete
 */
const deleteFromBlob = async (url) => {
    try {
        await del(url, {
            token: process.env.BLOB_READ_WRITE_TOKEN,
        });
    } catch (error) {
        console.error('Error deleting blob:', error.message);
    }
};

module.exports = {
    uploadToBlob,
    deleteFromBlob,
};
