import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Types for Pip2 instances
export interface Pip2Instance {
  id: string;
  discord_user_id: string;
  guild_id: string;
  guild_name: string;
  channel_id: string;
  channel_name: string;
  created_at: string;
  is_active: boolean;
}

// Get user's Pip2 instances
export async function getUserInstances(discordUserId: string): Promise<Pip2Instance[]> {
  const { data, error } = await supabase
    .from('pip2_instances')
    .select('*')
    .eq('discord_user_id', discordUserId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching instances:', error);
    return [];
  }

  return data || [];
}

// Create a new Pip2 instance
export async function createInstance(instance: Omit<Pip2Instance, 'id' | 'created_at'>): Promise<Pip2Instance | null> {
  const { data, error } = await supabase
    .from('pip2_instances')
    .insert(instance)
    .select()
    .single();

  if (error) {
    console.error('Error creating instance:', error);
    return null;
  }

  return data;
}

// Toggle instance active state
export async function toggleInstanceActive(instanceId: string, isActive: boolean): Promise<boolean> {
  const { error } = await supabase
    .from('pip2_instances')
    .update({ is_active: isActive })
    .eq('id', instanceId);

  if (error) {
    console.error('Error toggling instance:', error);
    return false;
  }

  return true;
}

// Delete an instance
export async function deleteInstance(instanceId: string): Promise<boolean> {
  const { error } = await supabase
    .from('pip2_instances')
    .delete()
    .eq('id', instanceId);

  if (error) {
    console.error('Error deleting instance:', error);
    return false;
  }

  return true;
}
