import crypto from "crypto";
import EmailPassword from "supertokens-node/recipe/emailpassword";
import { FastifyInstance } from 'fastify';

const generateTempPassword = () => crypto.randomBytes(8).toString("hex");

export async function createUserInSuperTokens(emailId: string, fastify: FastifyInstance) {

    console.log('creating user in super tokens', emailId);

    const password = generateTempPassword();
    const response = await EmailPassword.signUp(
        "public",
        emailId,
        password
    );

    if (response.status === "EMAIL_ALREADY_EXISTS_ERROR") {
        console.log('email already exists');
    }
   
    if (response.status === "OK") {
        console.log('userId created in supertokens successfully', response.user);
        console.log(`sending email to ${emailId} with password`);
        // const info = await fastify.mailer.sendMail({
        //     from: 'support@oldcrux.com',
        //     to: emailId,
        //     subject: 'Hello from TS',
        //     text: `Your temp password: ${password}`
        // })
        
        const info = await fastify.services.emailTemporaryPassword(emailId, password);
        console.log('email sent successfully', info);
    }
    else{
         console.log('error creating user', emailId);
    }
}

