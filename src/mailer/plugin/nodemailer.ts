// plugins/nodemailer.ts
import 'fastify';
import type { Transporter } from 'nodemailer';
import fp from 'fastify-plugin';
import nodemailer from 'nodemailer';
import { FastifyPluginAsync } from 'fastify';


const emailHost = process.env.EMAIL_HOST;
const emailUser = process.env.EMAIL_USER;
const emailpwd = process.env.EMAIL_PASSWORD;

const transporterOptions = nodemailer.createTransport({
    pool: true,
    host: emailHost,
    port: 465,
    secure: true,
    auth: {
        user: emailUser,
        pass: emailpwd
    }
});

const mailerPlugin: FastifyPluginAsync = async (fastify) => {
    // const transporter = nodemailer.createTransport(transporterOptions);

    // Add to Fastify instance
    fastify.decorate('mailer', transporterOptions);

    fastify.decorate("services", {
        emailTemporaryPassword: async (email: string, tempPW: string) => {
            return fastify.mailer.sendMail({
                from: process.env.EMAIL_USER,
                to: email,
                subject: "Reset password",
                text: `Your temp password is ${tempPW}`,
            });
        },
        organizationActivationEmail: async (email: string, orgName: string) => {
            return fastify.mailer.sendMail({
                from: process.env.EMAIL_USER,
                to: email,
                subject: "Organization Activation",
                text: `Your organization ${orgName} has been activated.  You should receive an email with your login credentials shortly.`,
            });
        },
        organizationDeactivationEmail: async (email: string, orgName: string) => {
            return fastify.mailer.sendMail({
                from: process.env.EMAIL_USER,
                to: email,
                subject: "Organization Deactivation",
                text: `Your organization ${orgName} has been deactivated.`,
            });
        }
    });
};

export default fp(mailerPlugin);


export const smtpSettings = {
    host: emailHost || '',
    authUsername: '', // this is optional. In case not given, from.email will be used
    password: emailpwd || '',
    port: 465,
    from: {
        name: emailUser || '',
        email: emailUser || '',
    },
    secure: true
}

declare module 'fastify' {
  interface FastifyInstance {
    mailer: Transporter;
    services: {
      emailTemporaryPassword(email: string, tempPW: string): Promise<any>;
      organizationActivationEmail(email: string, orgName: string): Promise<any>;
      organizationDeactivationEmail(email: string, orgName: string): Promise<any>;
    };
  }
}