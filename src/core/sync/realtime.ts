import { supabase } from '../../supabase';

/** Remote row changes from other devices. Requires the tables to be in the Supabase realtime publication. */
export function subscribeShoppingChanges(onChange: () => void) {
  const channel = supabase.channel(`caneto-shopping-${Date.now()}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'lists' }, () => onChange())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'items' }, () => onChange())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'purchase_history' }, () => onChange())
    .subscribe();
  return () => { void supabase.removeChannel(channel); };
}
