import "@fastify/jwt";
import { FastifyRequest, FastifyReply } from "fastify";

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: {
      sub: string;
      sessionId: string;
      email: string;
      roles: string[];
      jti: string;
    };
    user: {
      sub: string;
      sessionId: string;
      email: string;
      roles: string[];
      jti: string;
    };
  }
}

declare module "fastify" {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}
