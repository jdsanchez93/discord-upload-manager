import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { authMiddleware } from './services/auth.js';
import webhooks from './routes/webhooks.js';
import files from './routes/files.js';

export function createApp() {
    const app = new Hono().basePath('/api');

    // Middleware
    app.use('*', logger());
    app.use(
    '*',
    cors({
        origin: '*',
        allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowHeaders: ['Content-Type', 'Authorization'],
    })
    );

    // Health check (no auth required)
    app.get('/health', (c) => c.json({ status: 'healthy' }));

    // Protected routes
    app.use('/webhooks/*', authMiddleware);
    app.use('/files/*', authMiddleware);

    // Mount routes
    app.route('/webhooks', webhooks);
    app.route('/files', files);

    // 404 handler
    app.notFound((c) => c.json({ error: 'Not found' }, 404));

    // Error handler
    app.onError((err, c) => {
    console.error('Error:', err);
    return c.json({ error: 'Internal server error' }, 500);
    });

    return app;
}
