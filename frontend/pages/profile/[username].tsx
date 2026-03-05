import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { ArrowLeft, Loader2 } from 'lucide-react';
import UserProfile from '../../components/UserProfile';
import io, { Socket } from 'socket.io-client';

let socket: Socket;

export default function ProfilePage() {
    const router = useRouter();
    const { username } = router.query;

    const [profileData, setProfileData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // We also need the current active username to know if it's "isOwnProfile"
    const [activeUsername, setActiveUsername] = useState('');

    useEffect(() => {
        const storedUsername = localStorage.getItem('username');
        if (storedUsername) {
            setActiveUsername(storedUsername);
        }

        if (!username) return;

        // Connect to fetch profile
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
        socket = io(apiUrl);

        socket.on('connect', () => {
            socket.emit('getUserProfile', { username });
        });

        socket.on('userProfileData', (data) => {
            setProfileData(data);
            setLoading(false);
        });

        socket.on('error', (err) => {
            setError(err.message || 'Failed to load profile');
            setLoading(false);
        });

        // Listen to live updates if this is our own profile
        socket.on('profileUpdateSuccess', (updatedUser) => {
            setProfileData((prev: any) => ({
                ...prev,
                bio: updatedUser.bio,
                status: updatedUser.status,
                displayName: updatedUser.displayName,
                avatar: updatedUser.avatar,
                age: updatedUser.age
            }));
            // Update local storage too so changes persist back to rooms
            if (updatedUser.bio) localStorage.setItem('bio', updatedUser.bio);
            if (updatedUser.displayName) localStorage.setItem('displayName', updatedUser.displayName);
            if (updatedUser.status) localStorage.setItem('status', updatedUser.status);
            if (updatedUser.avatar) localStorage.setItem('avatar', updatedUser.avatar);
            if (updatedUser.age !== undefined) localStorage.setItem('age', updatedUser.age.toString());
        });

        return () => {
            if (socket) socket.disconnect();
        };
    }, [username]);

    const handleUpdate = (updates: any) => {
        if (socket && activeUsername === username) {
            socket.emit('updateProfile', { username: activeUsername, updates });
        }
    };

    const handleAvatarUpload = async (file: File) => {
        const formData = new FormData();
        formData.append('file', file);
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/upload`, {
            method: 'POST',
            body: formData
        });
        if (!response.ok) throw new Error('Upload failed');
        const { url, filename } = await response.json();

        const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
        const fullUrl = url.startsWith('http') ? url : `${baseUrl}${url}`;

        // Emit to server to save it to user profile
        socket.emit('uploadAvatar', { username: activeUsername, fileData: { filename, url: fullUrl } });
        return fullUrl;
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
        );
    }

    if (error || !profileData) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-200">
                <p className="text-xl mb-4">{error || 'User not found'}</p>
                <button
                    onClick={() => window.close()}
                    className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition"
                >
                    Close Window
                </button>
            </div>
        );
    }

    const isOwnProfile = activeUsername === profileData.username;

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
            <Head>
                <title>{profileData.displayName || profileData.username}'s Profile - Online Hangout</title>
            </Head>

            <div className="max-w-2xl mx-auto">
                <div className="mb-6 flex items-center justify-between">
                    <button
                        onClick={() => {
                            // If they came from somewhere in this app, try to go back.
                            // If opened in new tab, this might not do anything, so we give a fallback to close
                            if (window.history.length > 2) {
                                router.back();
                            } else {
                                window.close();
                            }
                        }}
                        className="flex items-center text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition"
                    >
                        <ArrowLeft className="w-5 h-5 mr-1" />
                        Go Back
                    </button>
                </div>

                <UserProfile
                    user={{
                        username: profileData.username,
                        displayName: profileData.displayName,
                        avatar: profileData.avatar,
                        bio: profileData.bio,
                        country: profileData.country,
                        gender: profileData.gender,
                        status: profileData.status,
                        createdAt: profileData.createdAt,
                        lastSeen: profileData.lastSeen,
                        role: profileData.globalRole,
                        age: profileData.age
                    }}
                    isOwnProfile={isOwnProfile}
                    onUpdate={isOwnProfile ? handleUpdate : undefined}
                    onAvatarUpload={isOwnProfile ? handleAvatarUpload : undefined}
                    onStartDM={undefined} // DMs should probably be started from within a room or direct messages tab, to avoid complex routing states here
                />
            </div>
        </div>
    );
}
