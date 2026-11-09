const APP_URL = window.location.origin;

const appUrl = (path = '') => {
    return `${APP_URL}/${path.replace(/^\/+/, '')}`;
};