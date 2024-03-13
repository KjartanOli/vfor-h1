import express, { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { Endpoint, Method, User, default_method_descriptor } from '../lib/types.js';
import * as users from '../lib/users.js';
import { jwt_secret, token_lifetime } from '../app.js';
import passport, { authenticate } from 'passport';

export const router = express.Router();

const endpoints: Array<Endpoint> = [
  {
    href: '/', methods: [
      {
        ...default_method_descriptor,
        method: Method.GET,
        handlers: [get_index]
      }
    ]
  },
  {
    href: '/login',
    methods: [
      {
        ...default_method_descriptor,
        method: Method.POST,
        handlers: [post_login]
      }
    ]
  },
  {
    href: '/games',
    methods: [
      {
        ...default_method_descriptor,
        method: Method.GET,
        handlers: [get_games]
      },
      {
        ...default_method_descriptor,
        method: Method.POST,
        authentication: [ensureAuthenticated, ensureAdmin],
        handlers: [post_game]
      }
    ]
  },
  {
    href: '/games/:id',
    methods: [
      {
        ...default_method_descriptor,
        method: Method.GET,
        handlers: [get_game_by_id]
      },
      {
        ...default_method_descriptor,
        method: Method.DELETE,
        authentication: [ensureAuthenticated, ensureAdmin],
        handlers: [delete_game_by_id]
      },
      {
        ...default_method_descriptor,
        method: Method.PATCH,
        authentication: [ensureAuthenticated, ensureAdmin],
        handlers: [patch_game_by_id]
      }
    ]
  },
  {
    href: '/games/:id/rating',
    methods: [
      {
        ...default_method_descriptor,
        method: Method.GET,
        handlers: [get_game_rating]
      },
      {
        ...default_method_descriptor,
        method: Method.POST,
        handlers: [post_game_rating]
      }
    ]
  }
]

async function ensureAuthenticated(req: Request, res: Response, next: NextFunction) {
  return passport.authenticate(
    'jwt',
    { session: false },
    // TODO: Find correct types for err and info
    (err: any, user: User, info: any) => {
      if (err)
        return next(err);
      if (!user) {
        const error = info.name === 'TokenExpiredError'
          ? 'expired token' : 'invalid token';
        return res.status(401).json({ error });
      }

      req.user = user;
      return next();
    })(req, res, next);
}

async function ensureAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user?.admin)
    return res.status(401).json({ error: 'Insufficient permissions' });

  next();
}


async function get_index(req: Request, res: Response) {
  res.json(endpoints.map(endpoint => ({
    href: endpoint.href,
    methods: endpoint.methods.map(endpoint => Method[endpoint.method])
  })));
}

async function post_login(req: Request, res: Response) {
  const { username, password = null } = req.body;

  const user = await users.find_by_username(username);
  if (user.isNone() || !await users.compare_passwords(password, user.value.password))
    return res.status(401).json({ error: 'Incorrect username or password' });

  const data = { id: user.value.id };
  const options = { expiresIn: token_lifetime() };
  const token = jwt.sign({ data }, jwt_secret(), options);

  return res.json({ token });
}

async function get_games(req: Request, res: Response) {
async function post_game(req: Request, res: Response) {
  const { name, category, description, studio, year } = req.body;
  if (!name || !category || !description || !studio || !year) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const game = await getDatabase()?.insertGame({
    name,
    category,
    description,
    studio,
    year
  })

  if (!game) {
    return res.status(500).json({ error: 'Could not insert game' });
  }

  return res.json(game);
}

async function get_game_by_id(req: Request, res: Response) {
  res.json({name: 'XCOM', publisher: 'Firaxis'});
}

async function get_game_rating(req: Request, res: Response) {
  res.json({ error: 'Not implemented' });
}

async function post_game_rating(req: Request, res: Response) {
  res.json({ error: 'Not implemented' });
}

async function post_games(req: Request, res: Response) {
  res.json({ error: 'Not implemented' });
}

async function delete_game_by_id(req: Request, res: Response) {
  res.json({ error: 'Not implemented' });
}

async function patch_game_by_id(req: Request, res: Response) {
  res.json({ error: 'Not implemented' });
}

endpoints.forEach(endpoint => {
  endpoint.methods.forEach(method => {
    switch (method.method) {
        case Method.GET:
          router.get(endpoint.href, ...[
            ...method.authentication,
            ...method.validation,
            ...method.handlers
          ]);
          break;
        case Method.POST:
          router.post(endpoint.href, ...[
            ...method.authentication,
            ...method.validation,
            ...method.handlers
          ]);
          break;
        case Method.PATCH:
          router.patch(endpoint.href, ...[
            ...method.authentication,
            ...method.validation,
            ...method.handlers
          ]);
          break;
        case Method.DELETE:
          router.delete(endpoint.href, ...[
            ...method.authentication,
            ...method.validation,
            ...method.handlers
          ]);
          break;
      }
  });
})

