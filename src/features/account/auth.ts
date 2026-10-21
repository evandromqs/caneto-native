import { makeRedirectUri } from 'expo-auth-session';
import * as QueryParams from 'expo-auth-session/build/QueryParams';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from '../../supabase';

WebBrowser.maybeCompleteAuthSession();

export const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
export const accountRedirectUri = makeRedirectUri({ scheme: 'caneto', path: 'auth/callback' });

export class DevelopmentBuildRequiredError extends Error {
  constructor() {
    super('O login com Google precisa de uma versão de desenvolvimento do Caneto instalada no celular. No Expo Go, use e-mail e senha.');
    this.name = 'DevelopmentBuildRequiredError';
  }
}

export type GoogleSignInResult = { status: 'signed-in'; userId: string } | { status: 'cancelled' };
export type AccountRedirectResult = { kind: 'signed-in' | 'recovery'; userId: string } | { kind: 'ignored' };

/** Accepts both the current implicit Supabase callback and a future PKCE callback. */
export async function completeAccountRedirect(url: string): Promise<AccountRedirectResult> {
  const { params, errorCode } = QueryParams.getQueryParams(url);
  if (errorCode || params.error || params.error_description) {
    throw new Error(params.error_description || params.error || errorCode || 'Falha ao entrar na conta.');
  }
  const isRecovery = params.type === 'recovery';
  if (params.code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(params.code);
    if (error) throw error;
    if (!data.user) throw new Error('O link não criou uma sessão válida.');
    return { kind: isRecovery ? 'recovery' : 'signed-in', userId: data.user.id };
  }
  if (params.access_token && params.refresh_token) {
    const { data, error } = await supabase.auth.setSession({
      access_token: params.access_token, refresh_token: params.refresh_token,
    });
    if (error) throw error;
    if (!data.user) throw new Error('O link não criou uma sessão válida.');
    return { kind: isRecovery ? 'recovery' : 'signed-in', userId: data.user.id };
  }
  return { kind: 'ignored' };
}

export async function signInWithGoogle(): Promise<GoogleSignInResult> {
  if (isExpoGo) throw new DevelopmentBuildRequiredError();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: accountRedirectUri,
      skipBrowserRedirect: true,
      queryParams: { prompt: 'select_account' },
    },
  });
  if (error) throw error;
  if (!data.url) throw new Error('O Google não retornou um endereço de autenticação.');
  const result = await WebBrowser.openAuthSessionAsync(data.url, accountRedirectUri);
  if (result.type !== 'success') return { status: 'cancelled' };
  const completed = await completeAccountRedirect(result.url);
  if (completed.kind === 'ignored') throw new Error('O Google não retornou uma sessão válida.');
  return { status: 'signed-in', userId: completed.userId };
}

export async function requestPasswordReset(email: string): Promise<void> {
  const cleanEmail = email.trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(cleanEmail)) throw new Error('Informe um e-mail válido.');
  // The email can be requested in Expo Go, but the recovery callback must be
  // tested in a development/production build with the registered caneto scheme.
  const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
    redirectTo: accountRedirectUri,
  });
  if (error) throw error;
}

export async function updatePassword(password: string): Promise<void> {
  if (password.length < 8) throw new Error('Use uma senha com pelo menos 8 caracteres.');
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!userData.user) throw new Error('Abra novamente o link de recuperação enviado por e-mail.');
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw error;
}
