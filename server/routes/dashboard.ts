import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Tạo __dirname cho ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

import { statsManager } from '../../src/services/stats-manager';
import { logManager } from '../../src/services/log-manager';
import { systemMonitor } from '../../src/services/system-monitor';
import { logger } from '../../src/utils/logger';

const router = express.Router();

// Serve static files from the React app
router.use(express.static(path.join(__dirname, '../../client/dist')));

// Dashboard route - Serve React app for all dashboard routes
router.get('/dashboard*', (req, res) => {
  logger.info(`Serving dashboard for path: ${req.path}`);
  res.sendFile(path.join(__dirname, '../../client/dist/index.html'));
});

// Admin routes - Serve React app
router.get('/admin*', (req, res) => {
  // TODO: Kiểm tra quyền admin ở đây
  logger.info(`Serving admin panel for path: ${req.path}`);
  res.sendFile(path.join(__dirname, '../../client/dist/index.html'));
});

// Login route - Serve React app
router.get('/login', (req, res) => {
  logger.info('Serving login page');
  res.sendFile(path.join(__dirname, '../../client/dist/index.html'));
});

// Profile route - Serve React app
router.get('/profile', (req, res) => {
  // TODO: Kiểm tra đăng nhập ở đây
  logger.info('Serving profile page');
  res.sendFile(path.join(__dirname, '../../client/dist/index.html'));
});

// Settings route - Serve React app
router.get('/settings*', (req, res) => {
  // TODO: Kiểm tra đăng nhập ở đây
  logger.info('Serving settings page');
  res.sendFile(path.join(__dirname, '../../client/dist/index.html'));
});

// Analytics route - Serve React app
router.get('/analytics*', (req, res) => {
  // TODO: Kiểm tra đăng nhập ở đây
  logger.info('Serving analytics page');
  res.sendFile(path.join(__dirname, '../../client/dist/index.html'));
});

// Logs route - Serve React app
router.get('/logs*', (req, res) => {
  // TODO: Kiểm tra đăng nhập ở đây
  logger.info('Serving logs page');
  res.sendFile(path.join(__dirname, '../../client/dist/index.html'));
});

// Catch all other routes and forward to React app
router.get('*', (req, res) => {
  logger.info(`Serving React app for path: ${req.path}`);
  res.sendFile(path.join(__dirname, '../../client/dist/index.html'));
});

export default router;