import express, { Request, Response, NextFunction } from 'express';
import { Endpoint, Method } from '../lib/types.js';

export const router = express.Router();

const endpoints: Array<Endpoint> = [
  {
    href: '/', methods: [
      {
        method: Method.GET,
        handlers: [get_index]
      }
    ]
  },
  {
    href: '/login',
    methods: [
      {
        method: Method.POST,
        handlers: [post_login]
      }
    ]
  },
]

async function get_index(req: Request, res: Response) {
  res.json(endpoints.map(endpoint => ({
    href: endpoint.href,
    methods: endpoint.methods.map(endpoint => Method[endpoint.method])
  })));
}

async function post_login(req: Request, res: Response) {
  res.json({ token: "Hello" });
}

endpoints.forEach(endpoint => {
  endpoint.methods.forEach(method => {
    switch (method.method) {
        case Method.GET:
          router.get(endpoint.href, method.handlers);
          break;
        case Method.POST:
          router.post(endpoint.href, method.handlers);
          break;
        case Method.PATCH:
          router.patch(endpoint.href, method.handlers);
          break;
        case Method.DELETE:
          router.delete(endpoint.href, method.handlers);
          break;
      }
  });
})
