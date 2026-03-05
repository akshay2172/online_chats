import React, { useEffect, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { useDarkMode } from '../pages/_app';

interface Props {
    url: string;
}

interface PreviewData {
    title: string | null;
    description: string | null;
    image: string | null;
    siteName: string | null;
    url: string;
}

const LinkPreview: React.FC<Props> = ({ url }) => {
    const [data, setData] = useState<PreviewData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const { darkMode } = useDarkMode();

    useEffect(() => {
        let isMounted = true;

        const fetchPreview = async () => {
            try {
                const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/link-preview?url=${encodeURIComponent(url)}`);

                if (!response.ok) {
                    throw new Error('Failed to fetch preview');
                }

                const result = await response.json();

                if (isMounted) {
                    if (result.success && result.preview) {
                        setData(result.preview);
                    } else {
                        setError(true);
                    }
                }
            } catch (err) {
                if (isMounted) {
                    setError(true);
                }
            } finally {
                if (isMounted) {
                    setLoading(false);
                }
            }
        };

        fetchPreview();

        return () => {
            isMounted = false;
        };
    }, [url]);

    if (loading) {
        return null; // Return nothing while loading to prevent jittering
    }

    if (error || !data) {
        return null; // Don't render anything if it fails or there's no data
    }

    return (
        <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="block mt-2 max-w-sm rounded-lg border overflow-hidden transition-all hover:opacity-90 shadow-sm"
            style={{
                backgroundColor: 'var(--bg-secondary)',
                borderColor: 'var(--border-color)',
                textDecoration: 'none'
            }}
            onClick={(e) => e.stopPropagation()} // Prevent triggering chat bubble actions
        >
            {data.image && (
                <img
                    src={data.image}
                    alt={data.title || 'Link Preview'}
                    className="w-full h-32 object-cover border-b"
                    style={{ borderColor: 'var(--border-color)' }}
                    loading="lazy"
                    onError={(e) => {
                        // Hide image if it fails to load
                        (e.target as HTMLImageElement).style.display = 'none';
                    }}
                />
            )}
            <div className="p-3">
                <div className="flex items-start justify-between gap-2">
                    <h4 className="text-sm font-semibold line-clamp-1 mb-1" style={{ color: 'var(--text-primary)' }}>
                        {data.title || data.siteName || url}
                    </h4>
                    <ExternalLink className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: 'var(--text-muted)' }} />
                </div>
                {data.description && (
                    <p className="text-xs line-clamp-2 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                        {data.description}
                    </p>
                )}
                <p className="text-[10px] mt-2 uppercase tracking-wider font-medium" style={{ color: 'var(--text-muted)' }}>
                    {data.siteName || new URL(url).hostname}
                </p>
            </div>
        </a>
    );
};

export default React.memo(LinkPreview);
