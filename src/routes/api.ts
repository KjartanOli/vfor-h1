import express, { Request, Response, NextFunction, RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { Endpoint, Method, MethodDescriptor, User, default_method_descriptor } from '../lib/types.js';
import * as users from '../lib/users.js';
import * as Games from '../lib/games.js';
import { jwt_secret, token_lifetime } from '../app.js';
import passport from 'passport';
import { check_validation, game_id_validator, new_game_validator, patch_game_validator } from '../lib/validators.js';
import { matchedData } from 'express-validator';

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
        validation: [...new_game_validator],
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
        validation: [game_id_validator],
        handlers: [get_game_by_id]
      },
      {
        ...default_method_descriptor,
        method: Method.DELETE,
        authentication: [ensureAuthenticated, ensureAdmin],
        validation: [game_id_validator],
        handlers: [delete_game_by_id]
      },
      {
        ...default_method_descriptor,
        method: Method.PATCH,
        authentication: [ensureAuthenticated, ensureAdmin],
        validation: [game_id_validator, ...patch_game_validator],
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
        validation: [game_id_validator],
        handlers: [get_game_rating]
      },
      {
        ...default_method_descriptor,
        method: Method.POST,
        validation: [game_id_validator],
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
  const games = await Games.get_games();

  if (games.isErr()) {
    return res.status(500).json({ error: 'Could not get games' });
  }

  return res.json(games.value);
}

async function post_game(req: Request, res: Response) {
  const { name, category, description, studio, year} = matchedData(req);

  const game = await Games.insert_game({
    name,
    category,
    description,
    studio,
    year
  });

  if (game.isErr()) {
    return res.status(500).json({ error: 'Could not insert game' });
  }

  return res.json(game.value);
}

async function get_game_by_id(req: Request, res: Response) {
  return res.json(req.resource);
}

async function delete_game_by_id(req: Request, res: Response) {
  const result = await Games.delete_game(req.resource);

    if (result.isErr())
      return res.status(500).json({ error: 'Could not delete game' });
    return res.status(204).json();
}

async function patch_game_by_id(req: Request, res: Response)
{
  const { game, name, category, description, studio, year } = matchedData(req);

  const updated_game = await Games.update_game({
    id: game.id,
    name: name || game.name,
    category: category || game.category,
    description: description || game.description,
    studio: studio || game.studio,
    year: year || game.year
  });

  if (!updated_game) {
    return res.status(500).json({ error: 'Could not update game' });
  }

  return res.json(updated_game);
}

async function get_game_rating(req: Request, res: Response) {
    const { id } = req.params;
    const ratings = await Games.get_ratings(parseInt(id));

    if (ratings.isErr()) {
        return res.status(500).json({ error: 'Could not get ratings' });
    }

    return res.json(ratings);
}

async function post_game_rating(req: Request, res: Response) {
    const { id } = req.params;
    const { rating } = req.body;
    if (!rating) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    const result = await Games.insert_rating(parseInt(id), rating);

    if (result.isErr()) {
        return res.status(500).json({ error: 'Could not insert rating' });
    }

    return res.json(result);
}

endpoints.forEach(endpoint => {
  endpoint.methods.forEach(method => {
    const routing_function = ((method: MethodDescriptor) => {
      switch (method.method) {
        case Method.GET:
          return (href: string, ...handlers: Array<RequestHandler>) => router.get(href, handlers)
        case Method.POST:
          return (href: string, ...handlers: Array<RequestHandler>) => router.post(href, handlers)
        case Method.PATCH:
          return (href: string, ...handlers: Array<RequestHandler>) => router.patch(href, handlers)
        case Method.DELETE:
          return (href: string, ...handlers: Array<RequestHandler>) => router.delete(href, handlers)
      }
    })(method);
    routing_function(endpoint.href, ...[
            ...method.authentication,
            ...method.validation,
            check_validation,
            ...method.handlers
    ]);
  });
});

