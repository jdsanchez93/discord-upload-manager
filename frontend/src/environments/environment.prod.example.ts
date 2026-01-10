export const environment = {
  production: true,
  apiUrl: 'https://api.example.com', // Replace with your API Gateway URL
  auth0: {
    domain: 'YOUR_AUTH0_DOMAIN',
    clientId: 'YOUR_AUTH0_CLIENT_ID',
    audience: 'YOUR_AUTH0_AUDIENCE',
    redirectUri: 'https://app.example.com' // Replace with your app domain
  }
};
