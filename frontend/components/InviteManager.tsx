import { useState, useEffect } from 'react';
import { Link, Copy, Trash2 } from 'lucide-react';

export default function InviteManager({ roomName, username, userRole }) {
  const [invites, setInvites] = useState([]);
  const [duration, setDuration] = useState('7d');
  const [maxUses, setMaxUses] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  
  const canCreate = ['owner', 'admin', 'moderator'].includes(userRole);
  
  useEffect(() => {
    if (canCreate) {
      loadInvites();
    }
  }, [roomName, canCreate]);
  
  const loadInvites = async () => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    const response = await fetch(`${apiUrl}/api/invites/room/${roomName}`);
    
    if (response.ok) {
      const data = await response.json();
      setInvites(data);
    }
  };
  
  const createInvite = async () => {
    setIsCreating(true);
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    
    try {
      const response = await fetch(`${apiUrl}/api/invites/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomName,
          createdBy: username,
          duration,
          maxUses: maxUses ? parseInt(maxUses) : undefined,
        }),
      });
      
      if (response.ok) {
        loadInvites();
        setMaxUses('');
      } else {
        alert('Failed to create invite');
      }
    } finally {
      setIsCreating(false);
    }
  };
  
  const copyInvite = (code) => {
    const link = `${window.location.origin}/invite/${code}`;
    navigator.clipboard.writeText(link);
    alert('Invite link copied!');
  };
  
  if (!canCreate) return null;
  
  return (
    <div className="p-4 bg-white rounded-lg shadow">
      <h3 className="font-bold mb-4">Invite Links</h3>
      
      <div className="flex gap-2 mb-4">
        <select
          value={duration}
          onChange={(e) => setDuration(e.target.value)}
          className="px-3 py-2 border rounded"
        >
          <option value="24h">24 hours</option>
          <option value="7d">7 days</option>
          <option value="30d">30 days</option>
        </select>
        
        <input
          type="number"
          placeholder="Max uses"
          value={maxUses}
          onChange={(e) => setMaxUses(e.target.value)}
          className="px-3 py-2 border rounded"
        />
        
        <button
          onClick={createInvite}
          disabled={isCreating}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {isCreating ? 'Creating...' : 'Create'}
        </button>
      </div>
      
      <div className="space-y-2">
        {invites.map(invite => (
          <div key={invite.code} className="flex items-center justify-between p-3 bg-gray-50 rounded">
            <div className="flex-1">
              <p className="font-mono">{invite.code}</p>
              <p className="text-xs text-gray-500">
                {invite.currentUses}/{invite.maxUses || '∞'} uses • 
                Expires {new Date(invite.expiresAt).toLocaleDateString()}
              </p>
            </div>
            
            <button
              onClick={() => copyInvite(invite.code)}
              className="p-2 hover:bg-gray-200 rounded"
            >
              <Copy className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}