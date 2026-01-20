export const environment = {
  production: true,
  apiUrl: '/api', // Same-origin via CloudFront path-based routing
  auth0: {
    domain: 'auth0.jd-sanchez.com',
    clientId: 'Q1KMhSth1II48EZnc28Tmas7oRMsjsXn',
    audience: 'uploads.jd-sanchez.com/api',
    redirectUri: 'https://uploads.jd-sanchez.com'
  }
};
