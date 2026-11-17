import { supabase } from '../../supabase';

/** Remote row changes from other devices. Requires the tables to be in the Supabase realtime publication. */
export function subscribeShoppingChanges(onChange: () => void) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const trigger = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      onChange();
    }, 350);
  };
  const channel = supabase.channel(`caneto-shopping-${Date.now()}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'lists' }, trigger)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'items' }, trigger)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'purchase_history' }, trigger)
    .subscribe();
  return () => {
    if (timer) clearTimeout(timer);
    void supabase.removeChannel(channel);
  };
}
