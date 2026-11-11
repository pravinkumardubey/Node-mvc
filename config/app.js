require('dotenv').config();

const APP_URL = process.env.APP_URL || 'http://localhost:3000';

const appUrl = (path = '') => `${APP_URL}/${path.replace(/^\/+/, '')}`;

module.exports = {
    APP_URL,
    url: appUrl,
    appUrl
};
