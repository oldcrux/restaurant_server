
import { FastifyRequest, FastifyReply } from 'fastify';
import { verifySession } from 'supertokens-node/recipe/session/framework/fastify';
import jwt from 'jsonwebtoken';

const BOT_SECRET = process.env.BOT_JWT_SECRET!;

export function verifyBotOrUserSession() {
  console.log(`Verifying bot or user session in auth.ts`);
  return async (req: FastifyRequest, reply: FastifyReply) => {
    const authHeader = req.headers.authorization;
    // console.log(`Validating authHeader in auth.ts: ${authHeader}`);
    // Check for bot token
    if (authHeader?.startsWith('Bot ')) {
      const token = authHeader.replace('Bot ', '');
      try {
        const decoded = jwt.verify(token, BOT_SECRET);
        console.log(`bot user: ${JSON.stringify(decoded.sub)}`);
        (req as any).user = { userId: decoded.sub, isBot: true };
        return; // ✅ allow request
      } catch (err) {
        return reply.code(401).send({ success: false, message: 'Invalid bot token' });
      }
    }
    await verifySession()(req, reply);
  };
}
