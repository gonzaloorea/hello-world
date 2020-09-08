import React from 'react';
import * as msal from "@azure/msal-browser";
import { msalConfig , loginRequest } from './Config';
import { getUserDetails, getUserAvatar } from './GraphService';


//Auth Provider with Authentication Code Flow
export default function withAuthProvider(WrappedComponent) {
    return class extends React.Component {
        constructor(props) {
            super(props);
            this.state = {
                error: null,
                isAuthenticated: false,
                user: {}
            };
            // Initialize the MSAL application object
            this.publicClientApplication = new msal.PublicClientApplication(msalConfig);
        }
        /*
        componentDidMount() {
            // If MSAL already has an account, the user
            // is already logged in
            var account = this.publicClientApplication.getAllAccounts();
            if (account) {
                // Enhance user object with data from Graph
                this.getUserProfile();
            }
        }
        */
        render() {
            return <WrappedComponent
                error={this.state.error}
                isAuthenticated={this.state.isAuthenticated}
                user={this.state.user}
                login={() => this.login()}
                logout={() => this.logout()}
                getAccessToken={(scopes) => this.getAccessToken(scopes)}
                setError={(message, debug) => this.setErrorMessage(message, debug)}
                {...this.props} />;
        }
        async login() {
            try {
                // Login via popup
                const loginResponse = await this.publicClientApplication.loginPopup(loginRequest);
                let usuario = loginResponse.account.username;
                // After login, get the user's profile
                await this.getUserProfile(usuario);
            }
            catch (err) {
                this.setState({
                    isAuthenticated: false,
                    user: {},
                    error: this.normalizeError(err)
                });
            }
        }

        logout() {
            /*
            const logoutRequest = {
                account: this.publicClientApplication.getAccountByUsername(username)
            };
            
            this.publicClientApplication.logout(logoutRequest);
            */
           this.publicClientApplication.logout(); //genérico que obliga a seleccionar la cuenta a cerrar con un popup
        }

        async getAccessToken(username) {
            let currentAccount = this.publicClientApplication.getAccountByUsername(username);
            
            let silentRequest = {
                scopes: ["User.Read"],
                account: currentAccount,
                forceRefresh: false
            };

            let interactiveRequest = {
                scopes: ["User.Read"],
                loginHint: currentAccount.username // For v1 endpoints, use upn from idToken claims
            };
            try {
                // Get the access token silently
                // If the cache contains a non-expired token, this function
                // will just return the cached token. Otherwise, it will
                // make a request to the Azure OAuth endpoint to get a token
                var silentResult = await this.publicClientApplication.acquireTokenSilent(silentRequest);
                return silentResult.accessToken;
            }
            catch (err) {
                // If a silent request fails, it may be because the user needs
                // to login or grant consent to one or more of the requested scopes
                if (this.isInteractionRequired(err)) {
                    var interactiveResult = await this.publicClientApplication.acquireTokenPopup(interactiveRequest);
                    return interactiveResult.accessToken;
                }
                else {
                    throw err;
                }
            }
        }
        // <getUserProfileSnippet>
        async getUserProfile(user) {
            
            try {
                let accessToken = await this.getAccessToken(user);
                if (accessToken) {
                    // Get the user's profile from Graph
                    let user = await getUserDetails(accessToken);
                    let avatar = await getUserAvatar(accessToken)
                    this.setState({
                        isAuthenticated: true,
                        user: {
                            displayName: user.displayName,
                            email: user.mail || user.userPrincipalName,
                            avatar: avatar
                        },
                        error: null
                    });
                }
            }
            catch (err) {
                this.setState({
                    isAuthenticated: false,
                    user: {},
                    error: this.normalizeError(err)
                });
            }
        }
        // </getUserProfileSnippet>
        setErrorMessage(message, debug) {
            this.setState({
                error: { message: message, debug: debug }
            });
        }
        normalizeError(error) {
            var normalizedError = {};
            if (typeof (error) === 'string') {
                var errParts = error.split('|');
                normalizedError = errParts.length > 1 ?
                    { message: errParts[1], debug: errParts[0] } :
                    { message: error };
            }
            else {
                normalizedError = {
                    message: error.message,
                    debug: JSON.stringify(error)
                };
            }
            return normalizedError;
        }
        isInteractionRequired(error) {
            if (!error.message || error.message.length <= 0) {
                return false;
            }
            return (error.message.indexOf('consent_required') > -1 ||
                error.message.indexOf('interaction_required') > -1 ||
                error.message.indexOf('login_required') > -1);
        }
    };
}