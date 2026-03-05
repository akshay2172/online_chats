import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

export default function InvitePage() {
  const router = useRouter();
  const { code } = router.query;
  const [invite, setInvite] = useState(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    if (code) {
      fetchInvite();
    }
  }, [code]);
  
  const fetchInvite = async () => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    const response = await fetch(`${apiUrl}/api/invites/${code}`);
    
    if (response.ok) {
      const data = await response.json();
      setInvite(data);
    } else {
      setError('Invalid or expired invite');
    }
    setIsLoading(false);
  };
  
  const acceptInvite = async () => {
    const username = localStorage.getItem('username');
    
    if (!username) {
      router.push(`/?redirect=/invite/${code}`);
      alert('Please log in to accept invite');
      return;
    }
    
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    const response = await fetch(`${apiUrl}/api/invites/${code}/use`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username }),
    });
    
    const result = await response.json();
    
    if (result.success) {
      router.push(`/room/${result.roomName}`);
    } else {
      setError(result.error);
    }
  };
  
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading invite...</p>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-2">Error</h1>
          <p>{error}</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="max-w-md w-full p-8 bg-white rounded-lg shadow-lg">
        <h1 className="text-2xl font-bold mb-2">Room Invitation</h1>
        <p className="text-gray-600 mb-6">
          You've been invited to join <strong>{invite?.roomName}</strong>
        </p>
        
        <div className="mb-6 p-4 bg-gray-50 rounded">
          <p className="text-sm text-gray-600">
            Invited by: <strong>{invite?.createdBy}</strong>
          </p>
          {invite?.description && (
            <p className="text-sm text-gray-600 mt-2">
              {invite.description}
            </p>
          )}
        </div>
        
        <button
          onClick={acceptInvite}
          className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
        >
          Accept Invitation
        </button>
      </div>
    </div>
  );
}