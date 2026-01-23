import { MiddlewareHandler } from 'hono';
import * as jose from 'jose';

const auth0Domain = process.env.AUTH0_DOMAIN || '';
const auth0Audience = process.env.AUTH0_AUDIENCE || '';

let jwks: jose.JWTVerifyGetKey | null = null;

async function getJwks(): Promise<jose.JWTVerifyGetKey> {
  if (!jwks) {
    jwks = jose.createRemoteJWKSet(
      new URL(`https://${auth0Domain}/.well-known/jwks.json`)
    );
  }
  return jwks;
}

export async function validateToken(token: string): Promise<string | null> {
  if (!auth0Domain || !auth0Audience) {
    console.error('AUTH0_DOMAIN and AUTH0_AUDIENCE must be configured');
    return null;
  }

  try {
    const jwks = await getJwks();
    const { payload } = await jose.jwtVerify(token, jwks, {
      issuer: `https://${auth0Domain}/`,
      audience: auth0Audience,
    });

    return payload.sub || null;
  } catch (error) {
    console.error('Token validation failed:', error);
    return null;
  }
}

declare module 'hono' {
  interface ContextVariableMap {
    userId: string;
  }
}

export const authMiddleware: MiddlewareHandler = async (c, next) => {
  const authHeader = c.req.header('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const token = authHeader.substring(7);
  const userId = await validateToken(token);

  if (!userId) {
    return c.json({ error: 'Invalid token' }, 401);
  }

  c.set('userId', userId);
  return next();
};
