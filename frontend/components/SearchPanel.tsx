import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Search, X, Filter, Calendar, User, FileText, Link, Image as ImageIcon, Music, Film, ArrowRight } from 'lucide-react';

export interface SearchMessage {
    _id: string;
    sender: string;
    message: string;
    createdAt: string;
    timestamp?: string;
    messageType?: string;
}

export interface SearchFilters {
    from?: string;
    has?: 'image' | 'file' | 'link' | 'gif' | 'voice';
    before?: string;
    after?: string;
    mentions?: string;
}

interface SearchPanelProps {
    isOpen: boolean;
    onClose: () => void;
    results: SearchMessage[];
    onSearch: (query: string, filters: SearchFilters) => void;
    onJumpToMessage: (messageId: string) => void;
    users: Array<{ name: string; displayName?: string; avatar?: string }>;
    isLoading: boolean;
}

const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const highlightMatch = (text: string, query: string) => {
    if (!query) return text;
    const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
    return (
        <>
            {parts.map((part, i) =>
                part.toLowerCase() === query.toLowerCase()
                    ? <span key={i} className="bg-yellow-200 dark:bg-yellow-900/50 text-yellow-900 dark:text-yellow-100 px-0.5 rounded">{part}</span>
                    : part
            )}
        </>
    );
};

export default function SearchPanel({
    isOpen,
    onClose,
    results,
    onSearch,
    onJumpToMessage,
    users,
    isLoading
}: SearchPanelProps) {
    const [query, setQuery] = useState('');
    const [filters, setFilters] = useState<SearchFilters>({});
    const [activeFilterType, setActiveFilterType] = useState<keyof SearchFilters | null>(null);
    const [filterInput, setFilterInput] = useState('');

    const filterMenuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (filterMenuRef.current && !filterMenuRef.current.contains(event.target as Node)) {
                setActiveFilterType(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSearch = useCallback(() => {
        onSearch(query, filters);
    }, [onSearch, query, filters]);

    const toggleFilter = (type: keyof SearchFilters) => {
        if (activeFilterType === type) {
            setActiveFilterType(null);
        } else {
            setActiveFilterType(type);
            setFilterInput(filters[type] || '');
        }
    };

    const applyFilter = (type: keyof SearchFilters, value: string) => {
        const newFilters = { ...filters, [type]: value };
        if (!value) delete newFilters[type];
        setFilters(newFilters);
        setActiveFilterType(null);
        setFilterInput('');
    };

    const removeFilter = (type: keyof SearchFilters) => {
        const newFilters = { ...filters };
        delete newFilters[type];
        setFilters(newFilters);
    };

    const renderFilterInput = () => {
        if (!activeFilterType) return null;

        switch (activeFilterType) {
            case 'has':
                return (
                    <div className="absolute top-full left-0 mt-2 w-48 bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg shadow-xl z-50 py-1">
                        {['image', 'file', 'link', 'gif', 'voice'].map((opt) => (
                            <button
                                key={opt}
                                onClick={() => applyFilter('has', opt as any)}
                                className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 dark:text-gray-200 capitalize"
                            >
                                {opt}
                            </button>
                        ))}
                    </div>
                );
            case 'before':
            case 'after':
                return (
                    <div className="absolute top-full left-0 mt-2 p-3 bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg shadow-xl z-50">
                        <input
                            type="date"
                            className="w-full p-2 text-sm border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded outline-none"
                            onChange={(e) => applyFilter(activeFilterType, e.target.value)}
                        />
                    </div>
                );
            case 'from':
            case 'mentions':
                const suggestions = users.filter(u =>
                    u.name.toLowerCase().includes(filterInput.toLowerCase())
                ).slice(0, 5);

                return (
                    <div className="absolute top-full left-0 mt-2 w-64 rounded-lg shadow-xl z-50 overflow-hidden"
                        style={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)' }}>
                        <input
                            type="text"
                            placeholder="Username..."
                            autoFocus
                            className="w-full p-3 text-sm border-b outline-none"
                            style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                            value={filterInput}
                            onChange={(e) => setFilterInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && applyFilter(activeFilterType, filterInput)}
                        />
                        <div className="max-h-40 overflow-y-auto">
                            {suggestions.map((u) => (
                                <button
                                    key={u.name}
                                    onClick={() => applyFilter(activeFilterType, u.name)}
                                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors"
                                    style={{ color: 'var(--text-primary)' }}
                                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-secondary)'}
                                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                >
                                    {u.avatar ? (
                                        <img src={u.avatar} alt={u.name} className="w-8 h-8 rounded-full object-cover shrink-0" />
                                    ) : (
                                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                                            style={{ backgroundColor: 'var(--accent-color)', color: 'white' }}>
                                            {(u.displayName || u.name).charAt(0).toUpperCase()}
                                        </div>
                                    )}
                                    <div className="flex flex-col items-start min-w-0">
                                        <span className="font-medium text-sm truncate" style={{ color: 'var(--text-primary)' }}>
                                            {u.displayName || u.name}
                                        </span>
                                        {u.displayName && u.displayName !== u.name && (
                                            <span className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                                                {u.name}
                                            </span>
                                        )}
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                );
        }
    };

    if (!isOpen) return null;

    return (
        <div className="absolute right-0 top-0 bottom-0 w-[400px] flex flex-col shadow-2xl border-l z-40 transition-all animate-in slide-in-from-right" style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-color)' }}>
            {/* Header */}
            <div className="p-4 border-b flex items-center justify-between" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}>
                <h3 className="font-bold text-lg flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                    <Filter className="w-5 h-5 text-blue-500" />
                    Advanced Filters
                </h3>
                <button
                    onClick={onClose}
                    className="p-1 rounded-full transition-colors hover:opacity-80"
                    style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}
                >
                    <X className="w-6 h-6" />
                </button>
            </div>


            {/* Search Bar & Filters */}
            <div className="p-4 space-y-4 shadow-sm">
                <div className="relative">
                    <input
                        type="text"
                        placeholder="Filter messages..."
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 transition-all border font-medium"
                        style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    />
                    <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
                    <button
                        onClick={handleSearch}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors shadow-lg shadow-blue-500/20"
                    >
                        <ArrowRight className="w-4 h-4" />
                    </button>
                </div>


                {/* Filter Selection Chips */}
                <div className="flex flex-wrap gap-2 relative" ref={filterMenuRef}>
                    {(['from', 'has', 'before', 'after', 'mentions'] as const).map((type) => (
                        <div key={type} className="relative">
                            <button
                                onClick={() => toggleFilter(type)}
                                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-full border transition-all ${activeFilterType === type
                                    ? 'bg-blue-500 border-blue-500 text-white shadow-md'
                                    : filters[type]
                                        ? 'bg-blue-50 border-blue-200 text-blue-600 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-300'
                                        : 'hover:opacity-80'
                                    }`}
                                style={{
                                    backgroundColor: activeFilterType !== type && !filters[type] ? 'var(--bg-secondary)' : undefined,
                                    borderColor: activeFilterType !== type && !filters[type] ? 'var(--border-color)' : undefined,
                                    color: activeFilterType !== type && !filters[type] ? 'var(--text-secondary)' : undefined
                                }}

                            >
                                {type}:
                                {filters[type] && <span className="opacity-80 font-normal">{filters[type]}</span>}
                                {filters[type] && (
                                    <X
                                        className="w-3 h-3 hover:text-red-500"
                                        onClick={(e) => { e.stopPropagation(); removeFilter(type); }}
                                    />
                                )}
                            </button>
                            {activeFilterType === type && renderFilterInput()}
                        </div>
                    ))}
                </div>
            </div>

            {/* Results */}
            <div className="flex-1 overflow-y-auto">
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center h-48 space-y-3 opacity-50">
                        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                        <p className="text-sm dark:text-gray-400">Searching history...</p>
                    </div>
                ) : results.length > 0 ? (
                    <div>
                        <p className="px-4 py-2 text-xs font-bold text-gray-400 uppercase tracking-wider dark:text-gray-500">
                            {results.length} Results
                        </p>
                        {results.map((msg) => (
                            <div
                                key={msg._id}
                                className="p-4 border-b group cursor-pointer transition-colors"
                                style={{ borderColor: 'var(--border-color)' }}
                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-secondary)'}
                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                onClick={() => onJumpToMessage(msg._id)}
                            >
                                <div className="flex items-center justify-between mb-1.5">
                                    <span className="font-bold text-sm text-blue-600 dark:text-blue-400">{msg.sender}</span>
                                    <span className="text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>{formatDate(msg.createdAt || msg.timestamp || '')}</span>
                                </div>
                                <p className="text-sm line-clamp-3 leading-relaxed" style={{ color: 'var(--text-primary)' }}>
                                    {highlightMatch(msg.message, query)}
                                </p>

                                <div className="flex items-center gap-3 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button className="text-[11px] font-bold text-blue-500 dark:text-blue-400 uppercase tracking-tight hover:underline">
                                        Jump to message
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : query || Object.keys(filters).length > 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-center p-8">
                        <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
                            <Search className="w-8 h-8 text-gray-400" />
                        </div>
                        <h4 className="font-bold dark:text-white mb-1">No results found</h4>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Try adjusting your filters or search terms</p>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center h-64 text-center p-8 text-gray-400">
                        <p className="text-sm">Search for messages from current room history</p>
                    </div>
                )}
            </div>
        </div>
    );
}
