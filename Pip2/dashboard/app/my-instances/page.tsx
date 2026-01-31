'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface Pip2Instance {
  id: string;
  discord_user_id: string;
  guild_id: string;
  guild_name: string;
  channel_id: string;
  channel_name: string;
  created_at: string;
  is_active: boolean;
}

export default function MyInstancesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [instances, setInstances] = useState<Pip2Instance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login?callbackUrl=/my-instances');
    }
  }, [status, router]);

  useEffect(() => {
    async function fetchInstances() {
      if (!session?.user) return;

      try {
        const response = await fetch('/api/instances');
        if (!response.ok) throw new Error('Failed to fetch instances');
        const data = await response.json();
        setInstances(data.instances || []);
      } catch (err) {
        setError('Failed to load your instances');
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    if (session?.user) {
      fetchInstances();
    }
  }, [session]);

  async function toggleInstance(instanceId: string, currentState: boolean) {
    try {
      const response = await fetch(`/api/instances/${instanceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !currentState }),
      });

      if (!response.ok) throw new Error('Failed to update instance');

      setInstances(instances.map(inst =>
        inst.id === instanceId ? { ...inst, is_active: !currentState } : inst
      ));
    } catch (err) {
      console.error('Error toggling instance:', err);
    }
  }

  async function deleteInstance(instanceId: string) {
    if (!confirm('Are you sure you want to delete this instance?')) return;

    try {
      const response = await fetch(`/api/instances/${instanceId}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete instance');

      setInstances(instances.filter(inst => inst.id !== instanceId));
    } catch (err) {
      console.error('Error deleting instance:', err);
    }
  }

  if (status === 'loading' || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return null; // Will redirect
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">My Pip 2 Instances</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Manage your OwlCloud connections across Discord servers
        </p>
      </div>

      {error && (
        <div className="bg-red-100 dark:bg-red-900/30 border border-red-400 text-red-700 dark:text-red-400 px-4 py-3 rounded mb-6">
          {error}
        </div>
      )}

      {instances.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 text-center">
          <div className="text-gray-400 text-5xl mb-4">+</div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            No instances yet
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Use the /owlcloud command in Discord to connect a server to OwlCloud.
          </p>
          <a
            href="/setup"
            className="inline-block bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-medium transition"
          >
            View Setup Guide
          </a>
        </div>
      ) : (
        <div className="space-y-4">
          {instances.map((instance) => (
            <div
              key={instance.id}
              className={`bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border-l-4 ${
                instance.is_active ? 'border-green-500' : 'border-gray-400'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {instance.guild_name}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400">
                    #{instance.channel_name}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
                    Created {new Date(instance.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => toggleInstance(instance.id, instance.is_active)}
                    className={`px-4 py-2 rounded-lg font-medium transition ${
                      instance.is_active
                        ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400'
                        : 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400'
                    }`}
                  >
                    {instance.is_active ? 'Pause' : 'Activate'}
                  </button>
                  <button
                    onClick={() => deleteInstance(instance.id)}
                    className="px-4 py-2 rounded-lg font-medium bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 transition"
                  >
                    Delete
                  </button>
                </div>
              </div>
              <div className="mt-4 flex items-center gap-2">
                <span
                  className={`inline-block w-2 h-2 rounded-full ${
                    instance.is_active ? 'bg-green-500' : 'bg-gray-400'
                  }`}
                />
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {instance.is_active ? 'Active' : 'Paused'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-8 bg-gray-100 dark:bg-gray-800/50 rounded-xl p-6">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Need help?</h3>
        <p className="text-gray-600 dark:text-gray-400 text-sm">
          To add a new instance, invite Pip 2 to your Discord server and use the{' '}
          <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">/owlcloud</code>{' '}
          command to connect it to OwlCloud.
        </p>
      </div>
    </div>
  );
}
