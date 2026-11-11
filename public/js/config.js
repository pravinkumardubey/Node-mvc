const APP_URL = window.location.origin;

function appUrl(path = '') {
    return `${APP_URL}/${path.replace(/^\/+/, '')}`;
}

window.APP_URL = APP_URL;
window.appUrl = appUrl;
