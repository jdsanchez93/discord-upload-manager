export const environment = {
  production: false,
  apiUrl: '/api', // Proxied to localhost:3002 via proxy.conf.json
  auth0: {
    domain: 'YOUR_AUTH0_DOMAIN',
    clientId: 'YOUR_AUTH0_CLIENT_ID',
    audience: 'YOUR_AUTH0_AUDIENCE',
    redirectUri: 'http://localhost:4200'
  }
};
