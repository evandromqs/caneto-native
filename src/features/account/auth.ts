import { makeRedirectUri } from 'expo-auth-session';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from '../../supabase';

function getQueryParams(input: string): { errorCode: string | null; params: Record<string, string> } {
  const url = new URL(input, 'https://phony.example');
  const errorCode = url.searchParams.get('errorCode');
  url.searchParams.delete('errorCode');
  const params: Record<string, string> = Object.fromEntries(url.searchParams.entries());
  if (url.hash) {
    new URLSearchParams(url.hash.replace(/^#/, '')).forEach((value, key) => {
      params[key] = value;
    });
  }
  return { errorCode, params };
}

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
  const { params, errorCode } = getQueryParams(url);
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

const GOOGLE_WEB_CLIENT_ID = '4035664531-a5qlg5i6np8fe1hu6ai0u6q9v8fp9lu7.apps.googleusercontent.com';

export async function signInWithGoogle(): Promise<GoogleSignInResult> {
  if (isExpoGo) throw new DevelopmentBuildRequiredError();
  const { GoogleSignin, statusCodes } = await import('@react-native-google-signin/google-signin');
  GoogleSignin.configure({ webClientId: GOOGLE_WEB_CLIENT_ID });
  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const response = await GoogleSignin.signIn();
    const idToken = response.data?.idToken;
    if (!idToken) return { status: 'cancelled' };
    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: 'google',
      token: idToken,
    });
    if (error) throw error;
    if (!data.user) throw new Error('O Google não retornou uma sessão válida.');
    return { status: 'signed-in', userId: data.user.id };
  } catch (error: unknown) {
    const code = (error as { code?: string })?.code;
    if (code === statusCodes.SIGN_IN_CANCELLED) {
      return { status: 'cancelled' };
    }
    throw error;
  }
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
