export const environment = {
  production: true,
  apiUrl: '/api', // Same-origin via CloudFront path-based routing
  auth0: {
    domain: 'YOUR_AUTH0_DOMAIN',
    clientId: 'YOUR_AUTH0_CLIENT_ID',
    audience: 'YOUR_AUTH0_AUDIENCE',
    redirectUri: 'https://app.example.com' // Replace with your app domain
  }
};
