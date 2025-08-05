import supertokens, { createUserIdMapping } from "supertokens-node";
import Session from "supertokens-node/recipe/session";
import EmailPassword from "supertokens-node/recipe/emailpassword";
import { getEnvVar } from "../../config.js";
import { HttpRequest } from "supertokens-node/types";
import { SMTPService } from "supertokens-node/recipe/emailpassword/emaildelivery";

import { FastifyInstance } from "fastify";
import { UserService } from "../../services/userService.js";
import { smtpSettings } from "../../mailer/plugin/nodemailer.js";


export const supertokensConfig = (fastify: FastifyInstance) => {
    const userService = UserService(fastify);
    supertokens.init({
        debug: false,
        framework: "fastify",
        supertokens: {
            // We use try.supertokens for demo purposes.
            // At the end of the tutorial we will show you how to create
            // your own SuperTokens core instance and then update your config.
            connectionURI: process.env.SUPERTOKENS_CORE || '',
            // apiKey: <YOUR_API_KEY>
            networkInterceptor: (request: HttpRequest) => {
                console.log("http request to core: ", request)
                // this can also be used to return a modified request object.
                return request;
            },
        },
        appInfo: {
            // learn more about this on https://supertokens.com/docs/session/appinfo
            appName: "OldCrux voice application",
            apiDomain: getEnvVar('BASE_URL', ''),
            websiteDomain: process.env.WEBSITE_DOMAIN || 'https://oldcrux.com',
            apiBasePath: "/auth",
            websiteBasePath: "/auth",
        },
        recipeList: [
            EmailPassword.init({
                emailDelivery: {
                    service: new SMTPService({
                        smtpSettings: { ...smtpSettings },
                        override: (originalImplementation) => {
                            return {
                                ...originalImplementation,
                                getContent: async function (input) {
                                    // password reset content
                                    // TODO customize the email template here
                                    // let { passwordResetLink, user } = input;
                                    let originalContent = await originalImplementation.getContent(input)
                                    return originalContent;
                                }
                            }
                        }
                    }),
                    override: (orig) => ({
                        ...orig,
                        sendEmail: async (input) => {
                            if (input.type === "PASSWORD_RESET") {
                                // modify input.passwordResetLink or email content
                            }
                            return orig.sendEmail(input);
                        },
                    })
                },
                override: {
                    functions: (original) => ({
                        ...original,
                        signUp: async (input) => {
                            const response = await original.signUp(input);
                            if (response.status === "OK") {
                                const superTokensUserId = response.user.id;
                                const email = input.email; // or input.formFields value
                                await createUserIdMapping({
                                    superTokensUserId,
                                    externalUserId: email
                                });
                            }
                            return response;
                        },
                        // signIn: async (input) => {
                        //     const response = await original.signIn(input);
                        //     if (response.status === "OK") {
                        //         const superTokensUserId = response.user.id;

                        //         const user = await userService.getUserById(superTokensUserId);
                        //         console.log(`user loaded: `, user);

                        //         if (user && !user.isActive) {
                        //             return {
                        //                 status: "WRONG_CREDENTIALS_ERROR",
                        //                 reason: "Your account is blocked. Contact support"
                        //             };
                        //         }

                        //     }
                        //     return response;
                        // }
                    }),
                }
            }),
            Session.init({
                override: {
                    functions: (originalImplementation) => {
                        return {
                            ...originalImplementation,

                            // here we are only overriding the function that's responsible
                            // for creating a new session
                            createNewSession: async function (input) {
                                const user = await userService.getUserById(input.userId);
                                console.log(`updating access token payload ${JSON.stringify(input.userId)}`);
                                input.accessTokenPayload = {
                                    ...input.accessTokenPayload,
                                    user: user
                                }

                                // or call the default behaviour as show below
                                return await originalImplementation.createNewSession(input);
                            },
                            // ...
                            // TODO: override more functions
                        }
                    }
                }
            }),
        ]
    });

}
