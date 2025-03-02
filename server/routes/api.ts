import { Router } from 'express';
import { z } from 'zod';
import { validateRequest } from '../middleware/validation';
import { logger } from '../../src/utils/logger';

const router = Router();

// API status route
router.get('/api/status', (req, res) => {
  res.json({
    status: 'online',
    message: 'API đang hoạt động',
    time: new Date().toISOString()
  });
});

// Login schema example
const loginSchema = z.object({
  body: z.object({
    username: z.string().min(3, "Tên đăng nhập phải có ít nhất 3 ký tự"),
    password: z.string().min(6, "Mật khẩu phải có ít nhất 6 ký tự")
  })
});

// Example API route with validation
router.post('/api/login', validateRequest(loginSchema), (req, res) => {
  try {
    const { username, password } = req.body;

    // Placeholder for actual authentication logic
    logger.info(`Login attempt for user: ${username}`);

    res.json({
      success: true,
      message: `Đăng nhập thành công với tài khoản ${username}`,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    // Middleware error handler will catch this
    const error = err instanceof Error ? err : new Error(String(err));
    error.name = 'LoginError';
    logger.error('Login error', error);

    throw error;
  }
});

// Example route with error
router.get('/api/test-error', (req, res) => {
  throw new Error('Test error thrown for debugging');
});

// User data example with schema validation
const userSchema = z.object({
  body: z.object({
    name: z.string().min(2, "Tên phải có ít nhất 2 ký tự"),
    email: z.string().email("Email không hợp lệ"),
    age: z.number().min(13, "Tuổi phải lớn hơn hoặc bằng 13").optional()
  })
});

router.post('/api/users', validateRequest(userSchema), (req, res) => {
  try {
    const userData = req.body;

    logger.info(`New user created: ${userData.name}`);

    res.json({
      success: true,
      message: `Đã tạo người dùng ${userData.name}`,
      user: {
        id: Math.random().toString(36).substring(2),
        ...userData,
        createdAt: new Date().toISOString()
      }
    });
  } catch (err) {
    // Let middleware handle this
    throw err;
  }
});

// Stats endpoints
router.get('/api/stats', (req, res) => {
  // Mock stats
  res.json({
    users: 1253,
    messages: 42890,
    bots: 5,
    uptime: process.uptime(),
    memory: process.memoryUsage()
  });
});

export default router;