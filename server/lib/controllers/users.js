import { Router } from 'express';
import authenticate from '../middleware/authenticate.js';
import UserService from '../services/UserService.js';

const ONE_DAY_IN_MS = 1000 * 60 * 60 * 24;

export default Router()
  .post('/', async (req, res, next) => {
    try {
      const user = await UserService.create(req.body); // calling UserService instead of model
      res.json(user);
    } catch (e) {
      next(e);
    }
  })

  .post('/sessions', async (req, res, next) => {
    try {
      const { token, user } = await UserService.signIn(req.body); // go check if they can have a wristband
      res
        .cookie(process.env.COOKIE_NAME, token, {
          httpOnly: true,
          secure: process.env.SECURE_COOKIES === 'true',
          sameSite: process.env.SECURE_COOKIES === 'true' ? 'none' : 'strict',
          maxAge: ONE_DAY_IN_MS,
        })
        .json({ user });
    } catch (e) {
      next(e);
    }
  })

  .get('/me', authenticate, async (req, res, next) => {
    try {
      res.json(req.user);
    } catch (e) {
      next(e);
    }
  })

  .get('/protected', authenticate, async (req, res) => {
    res.json({ message: 'hello world' });
  })

  .delete('/sessions', (req, res) => {
    res
      .clearCookie(process.env.COOKIE_NAME, {
        httpOnly: true,
        secure: process.env.SECURE_COOKIES === 'true',
        sameSite: process.env.SECURE_COOKIES === 'true' ? 'none' : 'strict',
        maxAge: ONE_DAY_IN_MS,
      })
      .status(204)
      .send();
  });
