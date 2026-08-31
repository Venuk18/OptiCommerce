import { app, initDatabase } from './app';
import { config } from './config/env';

const PORT = config.port;

export function startServer(port: number = PORT) {
  const server = app.listen(port, '0.0.0.0', async () => {
    console.log(`Server is running on port ${port}`);
    await initDatabase();
  });
  return server;
}

// Start server on entry point execution
startServer();

export { app, initDatabase };
export default app;
