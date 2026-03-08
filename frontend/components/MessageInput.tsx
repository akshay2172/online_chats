// frontend/components/MessageInput.tsx - ENHANCED WITH FIXES
import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Send,
  Paperclip,
  Smile,
  X,
  Mic,
  Image as ImageIcon,
  File as FileIcon,
  AtSign,
  MoreVertical,
  Moon,
  Sun,
  Sparkles,
  FileImage,
  Loader2
} from 'lucide-react';
import EmojiPicker, { EmojiClickData, Theme as EmojiTheme } from 'emoji-picker-react';
import { useDarkMode } from '../pages/_app';

interface Props {
  onSend: (message: string, replyTo?: string | null, mentions?: string[], messageType?: 'text' | 'gif' | 'sticker') => void;
  onFileUpload?: (file: File) => void;
  onVoiceRecord?: (audioBlob: Blob) => void;
  onSendGif?: (gifUrl: string, gifData: { width: number; height: number; preview: string }) => void;
  onSendSticker?: (stickerUrl: string) => void;
  replyTo?: any;
  replyPreview?: string;
  onCancelReply?: () => void;
  disabled?: boolean;
  users?: string[];
  onTyping?: (isTyping: boolean) => void;
}

const MessageInput: React.FC<Props> = ({
  onSend,
  onFileUpload,
  onVoiceRecord,
  onSendGif,
  onSendSticker,
  replyTo = null,
  replyPreview = '',
  onCancelReply,
  disabled = false,
  users = [],
  onTyping,
}) => {
  const [input, setInput] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showMentions, setShowMentions] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [showStickerPicker, setShowStickerPicker] = useState(false);
  const [mentionSearch, setMentionSearch] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isRecordingCancelled, setIsRecordingCancelled] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [gifSearch, setGifSearch] = useState('');
  const [gifs, setGifs] = useState<any[]>([]);
  const [stickers, setStickers] = useState<any[]>([]);
  const [isLoadingGifs, setIsLoadingGifs] = useState(false);
  const [isLoadingStickers, setIsLoadingStickers] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);

  const { darkMode, toggleDarkMode } = useDarkMode();

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Typing timeout and stable onTyping ref
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const onTypingRef = useRef(onTyping);
  useEffect(() => {
    onTypingRef.current = onTyping;
  }, [onTyping]);

  const MIN_ROWS = 1;
  const MAX_ROWS = 6;
  const LINE_HEIGHT = 20;

  const TENOR_API_KEY = 'AIzaSyAyimkuYQYF_FXVALexPuGQctUWRURdCYQ';

  useEffect(() => {
    inputRef.current?.focus();
  }, [replyTo]);

  // Handle addMention event from ChatWindow
  useEffect(() => {
    const handleAddMention = (event: CustomEvent) => {
      const username = event.detail;
      const mention = `@${username} `;
      const cursorPos = inputRef.current?.selectionStart || input.length;
      const newValue = input.slice(0, cursorPos) + mention + input.slice(cursorPos);
      setInput(newValue);
      setTimeout(() => {
        inputRef.current?.focus();
        const newPos = cursorPos + mention.length;
        inputRef.current?.setSelectionRange(newPos, newPos);
      }, 0);
    };

    window.addEventListener('addMention', handleAddMention as EventListener);
    return () => window.removeEventListener('addMention', handleAddMention as EventListener);
  }, [input]);

  const adjustHeight = () => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const maxH = MAX_ROWS * LINE_HEIGHT;
    const newH = Math.min(Math.max(el.scrollHeight, MIN_ROWS * LINE_HEIGHT), maxH);
    el.style.height = `${newH}px`;
  };

  useEffect(() => {
    adjustHeight();
  }, [input]);

  useEffect(() => {
    const lastWord = input.split(' ').pop() || '';
    if (lastWord.startsWith('@')) {
      setMentionSearch(lastWord.substring(1));
      setShowMentions(true);
    } else {
      setShowMentions(false);
    }
  }, [input]);

  // Typing indicator debounce logic (uses ref to avoid re-firing on every render)
  useEffect(() => {
    if (!onTypingRef.current) return;

    if (input.trim()) {
      onTypingRef.current(true);

      // Clear existing timeout to reset the timer
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      // Set new timeout to stop typing indicator after 1.5 seconds of inactivity
      typingTimeoutRef.current = setTimeout(() => {
        onTypingRef.current?.(false);
      }, 1500);
    } else {
      // Instantly stop typing if the input is completely empty
      onTypingRef.current(false);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    }

    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [input]);

  const extractMentions = (text: string): string[] => {
    const mentionRegex = /@(\w+)/g;
    const mentions: string[] = [];
    let match;
    while ((match = mentionRegex.exec(text)) !== null) {
      mentions.push(match[1]);
    }
    return mentions;
  };

  const filteredUsers = users.filter(user =>
    user.toLowerCase().includes(mentionSearch.toLowerCase())
  );

  const handleMentionSelect = (username: string) => {
    const words = input.split(' ');
    words[words.length - 1] = `@${username} `;
    setInput(words.join(' '));
    setShowMentions(false);
    inputRef.current?.focus();
  };

  // 👉 FIXED: Clearing typing indicator when message is sent
  const handleSend = async () => {
    if ((input.trim() === '' && !selectedFile) || disabled) return;

    // Immediately stop the typing indicator and clear the timeout
    if (onTypingRef.current) onTypingRef.current(false);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    if (selectedFile && onFileUpload) {
      await handleFileUpload(selectedFile);
      setSelectedFile(null);
    } else if (input.trim()) {
      const mentions = extractMentions(input);
      onSend(input.trim(), replyTo ? String(replyTo._id || replyTo.id) : null, mentions, 'text');
      setInput('');
    }

    setShowEmojiPicker(false);
    setTimeout(adjustHeight, 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    if (e.key === 'Escape') {
      if (replyTo !== null) {
        onCancelReply?.();
      }
      if (selectedFile) {
        setSelectedFile(null);
      }
      setShowEmojiPicker(false);
      setShowMenu(false);
      setShowGifPicker(false);
      setShowStickerPicker(false);
    }
  };

  const handleEmojiClick = (emojiData: EmojiClickData) => {
    const emoji = emojiData.emoji;
    const inputElement = inputRef.current;
    if (inputElement) {
      const start = inputElement.selectionStart || input.length;
      const end = inputElement.selectionEnd || input.length;
      const newValue = input.substring(0, start) + emoji + input.substring(end);
      setInput(newValue);
      setTimeout(() => {
        inputElement.focus();
        const newCursorPos = start + emoji.length;
        inputElement.setSelectionRange(newCursorPos, newCursorPos);
        adjustHeight();
      }, 0);
    } else {
      setInput(prev => prev + emoji);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 30 * 1024 * 1024) {
        alert('File size must be less than 30MB');
        return;
      }
      setSelectedFile(file);
      setShowMenu(false);
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        alert('Image size must be less than 10MB');
        return;
      }
      setSelectedFile(file);
      setShowMenu(false);
    }
  };

  const handleFileUpload = async (file: File) => {
    if (!onFileUpload) return;

    setIsUploading(true);
    setUploadProgress(0);

    // Simulate progress for better UX
    const progressInterval = setInterval(() => {
      setUploadProgress(prev => Math.min(prev + 10, 90));
    }, 200);

    try {
      await onFileUpload(file);
      setUploadProgress(100);
    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
      clearInterval(progressInterval);
      setTimeout(() => {
        setIsUploading(false);
        setUploadProgress(0);
      }, 500);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      const audioChunks: Blob[] = [];
      mediaRecorder.ondataavailable = (event) => {
        audioChunks.push(event.data);
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        // Check local ref or state equivalent to see if it was cancelled
        if (onVoiceRecord && !(mediaRecorderRef.current as any)?.cancelled) {
          onVoiceRecord(audioBlob);
        }
        stream.getTracks().forEach(track => track.stop());
      };

      // Store a custom property to track cancellation
      (mediaRecorder as any).cancelled = false;
      mediaRecorder.start();
      setIsRecording(true);
      setIsRecordingCancelled(false);
      setRecordingTime(0);

      recordingTimerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (error) {
      console.error('Error accessing microphone:', error);
      alert('Could not access microphone. Please check permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      (mediaRecorderRef.current as any).cancelled = true;
      setIsRecordingCancelled(true);

      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());

      setIsRecording(false);
      setRecordingTime(0);
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
    }
  };

  const searchGifs = async (query: string) => {
    if (!query.trim()) {
      // Load trending GIFs if no query
      setIsLoadingGifs(true);
      try {
        const response = await fetch(
          `https://tenor.googleapis.com/v2/featured?key=${TENOR_API_KEY}&limit=30`
        );
        const data = await response.json();
        setGifs(data.results || []);
      } catch (error) {
        console.error('Error fetching trending GIFs:', error);
        setGifs([]);
      } finally {
        setIsLoadingGifs(false);
      }
      return;
    }

    setIsLoadingGifs(true);
    try {
      const response = await fetch(
        `https://tenor.googleapis.com/v2/search?q=${encodeURIComponent(query)}&key=${TENOR_API_KEY}&limit=30`
      );
      const data = await response.json();
      setGifs(data.results || []);
    } catch (error) {
      console.error('Error fetching GIFs:', error);
      setGifs([]);
    } finally {
      setIsLoadingGifs(false);
    }
  };

  const searchStickers = async () => {
    setIsLoadingStickers(true);
    try {
      const response = await fetch(
        `https://tenor.googleapis.com/v2/featured?key=${TENOR_API_KEY}&contentfilter=low&media_filter=sticker&limit=20`
      );
      const data = await response.json();
      setStickers(data.results || []);
    } catch (error) {
      console.error('Error fetching stickers:', error);
      setStickers([]);
    } finally {
      setIsLoadingStickers(false);
    }
  };

  const handleGifSelect = (gif: any) => {
    if (onSendGif) {
      // Extract the actual GIF URL from Tenor's response
      const gifUrl = gif.media_formats?.gif?.url || gif.media_formats?.mediumgif?.url;
      const gifData = {
        width: gif.media_formats?.gif?.dims?.[0] || 400,
        height: gif.media_formats?.gif?.dims?.[1] || 300,
        preview: gif.media_formats?.tinygif?.url || gifUrl,
      };
      onSendGif(gifUrl, gifData);
    } else {
      // Fallback: send as special message type
      const gifUrl = gif.media_formats?.gif?.url || gif.media_formats?.mediumgif?.url;
      onSend(gifUrl, replyTo ? String(replyTo._id || replyTo.id) : null, [], 'gif');
    }
    setShowGifPicker(false);
    setShowMenu(false);
    setGifSearch('');
  };

  const handleStickerSelect = (stickerUrl: string | undefined) => {
    if (!stickerUrl) {
      console.warn('Sticker URL is undefined');
      return;
    }
    if (onSendSticker) {
      onSendSticker(stickerUrl);
    } else {
      // Fallback: send as message
      onSend(stickerUrl, replyTo?._id || replyTo?.id, []);
    }
    setShowStickerPicker(false);
    setShowMenu(false);
  };

  const formatRecordingTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showEmojiPicker && emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) {
        setShowEmojiPicker(false);
      }
      if (showMenu && menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showEmojiPicker, showMenu]);

  // Voice recording UI
  if (isRecording) {
    return (
      <div
        className="border-t px-4 py-3 shrink-0"
        style={{
          backgroundColor: 'var(--bg-primary)',
          borderColor: 'var(--border-color)'
        }}
      >
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 flex-1">
            <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
            <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Recording...</span>
            <span className="text-sm font-mono" style={{ color: 'var(--text-primary)' }}>
              {formatRecordingTime(recordingTime)}
            </span>
          </div>
          <button
            onClick={cancelRecording}
            className="px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={stopRecording}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            Send
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="border-t px-4 py-3 shrink-0"
      style={{
        backgroundColor: 'var(--bg-primary)',
        borderColor: 'var(--border-color)'
      }}
    >
      {/* Reply Preview */}
      {replyTo !== null && (
        <div
          className="mb-3 flex items-center justify-between rounded-lg px-3 py-2 border-l-4 min-w-0"
          style={{
            backgroundColor: 'var(--bg-secondary)',
            borderLeftColor: 'var(--accent-color)'
          }}
        >
          <div className="flex items-center space-x-2 overflow-hidden min-w-0">
            <span
              className="text-sm font-medium shrink-0"
              style={{ color: 'var(--accent-color)' }}
            >
              Replying to:
            </span>
            <span
              className="text-sm truncate min-w-0"
              style={{ color: 'var(--text-secondary)' }}
            >
              {replyPreview}
            </span>
          </div>
          <button
            onClick={onCancelReply}
            className="p-1 rounded-full transition-colors shrink-0"
            style={{ '--hover-bg': 'var(--bg-tertiary)' } as React.CSSProperties}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <X className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
          </button>
        </div>
      )}

      {/* Selected File Preview */}
      {selectedFile && (
        <div
          className="mb-3 flex items-center justify-between rounded-lg px-3 py-2 border"
          style={{
            backgroundColor: 'var(--bg-secondary)',
            borderColor: 'var(--border-color)'
          }}
        >
          <div className="flex items-center space-x-2 overflow-hidden">
            {selectedFile.type.startsWith('image/') ? (
              <ImageIcon className="w-5 h-5 shrink-0" style={{ color: 'var(--text-muted)' }} />
            ) : (
              <FileIcon className="w-5 h-5 shrink-0" style={{ color: 'var(--text-muted)' }} />
            )}
            <span className="text-sm truncate" style={{ color: 'var(--text-secondary)' }}>
              {selectedFile.name}
            </span>
            <span className="text-xs shrink-0" style={{ color: 'var(--text-muted)' }}>
              ({(selectedFile.size / 1024).toFixed(1)} KB)
            </span>
          </div>
          <button
            onClick={() => setSelectedFile(null)}
            className="p-1 rounded-full transition-colors shrink-0"
            style={{ '--hover-bg': 'var(--bg-tertiary)' } as React.CSSProperties}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <X className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
          </button>
        </div>
      )}

      {/* Upload Progress */}
      {isUploading && (
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Uploading...</span>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{uploadProgress}%</span>
          </div>
          <div
            className="w-full h-2 rounded-full overflow-hidden"
            style={{ backgroundColor: 'var(--bg-tertiary)' }}
          >
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${uploadProgress}%`,
                backgroundColor: 'var(--accent-color)'
              }}
            />
          </div>
        </div>
      )}

      {/* Mentions Dropdown */}
      {showMentions && filteredUsers.length > 0 && (
        <div
          className="mb-2 border rounded-lg shadow-lg max-h-40 overflow-y-auto"
          style={{
            backgroundColor: 'var(--menu-bg)',
            borderColor: 'var(--border-color)'
          }}
        >
          {filteredUsers.map(user => (
            <button
              key={user}
              onClick={() => handleMentionSelect(user)}
              className="w-full px-4 py-2 text-left flex items-center gap-2 transition-colors"
              style={{
                color: 'var(--text-primary)',
                '--hover-bg': 'var(--menu-hover)'
              } as React.CSSProperties}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--menu-hover)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <AtSign className="w-4 h-4" style={{ color: 'var(--accent-color)' }} />
              <span className="text-sm">{user}</span>
            </button>
          ))}
        </div>
      )}

      {/* GIF Picker */}
      {showGifPicker && (
        <div
          className="mb-2 border rounded-lg shadow-lg p-4 max-h-96 overflow-y-auto"
          style={{
            backgroundColor: 'var(--menu-bg)',
            borderColor: 'var(--border-color)'
          }}
        >
          <div className="mb-3">
            <input
              type="text"
              placeholder="Search GIFs..."
              value={gifSearch}
              onChange={(e) => {
                setGifSearch(e.target.value);
                if (e.target.value) searchGifs(e.target.value);
              }}
              className="w-full p-2 border rounded transition-colors"
              style={{
                backgroundColor: 'var(--bg-secondary)',
                borderColor: 'var(--border-color)',
                color: 'var(--text-primary)'
              }}
            />
          </div>
          {isLoadingGifs ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--accent-color)' }} />
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {gifs.map((gif, i) => (
                <img
                  key={i}
                  src={gif.media_formats?.tinygif?.url || gif.media_formats?.gif?.url}
                  alt="GIF"
                  className="w-full h-24 object-cover rounded cursor-pointer hover:opacity-80 transition-opacity"
                  onClick={() => handleGifSelect(gif)}
                  loading="lazy"
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Sticker Picker */}
      {showStickerPicker && (
        <div
          className="mb-2 border rounded-lg shadow-lg p-4 max-h-96 overflow-y-auto"
          style={{
            backgroundColor: 'var(--menu-bg)',
            borderColor: 'var(--border-color)'
          }}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Stickers</span>
            <button
              onClick={() => searchStickers()}
              className="text-xs px-2 py-1 rounded transition-colors"
              style={{
                backgroundColor: 'var(--bg-secondary)',
                color: 'var(--text-secondary)'
              }}
            >
              Refresh
            </button>
          </div>
          {isLoadingStickers ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--accent-color)' }} />
            </div>
          ) : stickers.length === 0 ? (
            <div className="text-center py-4" style={{ color: 'var(--text-muted)' }}>
              No stickers available. Click refresh to load.
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-2">
              {stickers.map((sticker, i) => (
                <img
                  key={i}
                  src={sticker.media_formats?.tinygif?.url || sticker.media_formats?.gif?.url}
                  alt="Sticker"
                  className="w-full h-20 object-contain cursor-pointer hover:opacity-80 hover:scale-105 transition-all"
                  onClick={() => handleStickerSelect(sticker.media_formats?.gif?.url || sticker.media_formats?.tinygif?.url)}
                  loading="lazy"
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Input Row */}
      <div className="flex items-end gap-2 min-w-0">
        <input
          ref={fileInputRef}
          type="file"
          onChange={handleFileSelect}
          className="hidden"
          accept=".pdf,.doc,.docx,.zip,audio/*,video/*"
        />
        <input
          ref={imageInputRef}
          type="file"
          onChange={handleImageSelect}
          className="hidden"
          accept="image/*"
        />

        {/* Menu Button */}
        <div className="relative shrink-0">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-2 rounded-full transition-colors"
            style={{
              color: 'var(--text-muted)',
              '--hover-bg': 'var(--bg-secondary)',
              '--hover-color': 'var(--text-primary)'
            } as React.CSSProperties}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--bg-secondary)';
              e.currentTarget.style.color = 'var(--text-primary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = 'var(--text-muted)';
            }}
            title="More options"
          >
            <MoreVertical className="w-5 h-5" />
          </button>

          {/* Menu Dropdown */}
          {showMenu && (
            <div
              ref={menuRef}
              className="absolute bottom-full left-0 mb-2 rounded-xl shadow-xl py-1.5 min-w-[180px] z-50 theme-menu border"
              style={{
                backgroundColor: 'var(--menu-bg)',
                borderColor: 'var(--border-color)'
              }}
            >
              <button
                onClick={() => {
                  imageInputRef.current?.click();
                  setShowMenu(false);
                }}
                className="w-full px-4 py-2 text-sm flex items-center gap-2 theme-menu-item transition-colors"
                style={{ color: 'var(--text-primary)' }}
              >
                <ImageIcon className="w-4 h-4" />
                Attach Image
              </button>

              <button
                onClick={() => {
                  fileInputRef.current?.click();
                  setShowMenu(false);
                }}
                className="w-full px-4 py-2 text-sm flex items-center gap-2 theme-menu-item transition-colors"
                style={{ color: 'var(--text-primary)' }}
              >
                <Paperclip className="w-4 h-4" />
                Attach File
              </button>

              <button
                onClick={() => {
                  toggleDarkMode();
                  setShowMenu(false);
                }}
                className="w-full px-4 py-2 text-sm flex items-center gap-2 theme-menu-item transition-colors"
                style={{ color: 'var(--text-primary)' }}
              >
                {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                {darkMode ? 'Light Mode' : 'Dark Mode'}
              </button>

              <button
                onClick={() => {
                  setShowGifPicker(!showGifPicker);
                  setShowStickerPicker(false);
                  setShowMenu(false);
                  if (!showGifPicker) searchGifs('trending');
                }}
                className="w-full px-4 py-2 text-sm flex items-center gap-2 theme-menu-item transition-colors"
                style={{ color: 'var(--text-primary)' }}
              >
                <FileImage className="w-4 h-4" />
                GIFs
              </button>

              <button
                onClick={() => {
                  setShowStickerPicker(!showStickerPicker);
                  setShowGifPicker(false);
                  setShowMenu(false);
                  searchStickers();
                }}
                className="w-full px-4 py-2 text-sm flex items-center gap-2 theme-menu-item transition-colors"
                style={{ color: 'var(--text-primary)' }}
              >
                <Sparkles className="w-4 h-4" />
                Stickers
              </button>
            </div>
          )}
        </div>

        {/* Text Input */}
        <div className="flex-1 min-w-0 relative flex items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={disabled ? "Connecting..." : "Type a message... (@mention users)"}
            disabled={disabled}
            rows={MIN_ROWS}
            style={{
              minHeight: `${MIN_ROWS * LINE_HEIGHT}px`,
              maxHeight: `${MAX_ROWS * LINE_HEIGHT}px`,
              backgroundColor: 'var(--bg-secondary)',
              color: 'var(--text-primary)'
            }}
            className="w-full min-w-0 resize-none overflow-y-auto py-2.5 pl-4 pr-10 border-0 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-[15px] leading-5 break-words"
          />

          <button
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className="absolute right-2 bottom-2 p-1.5 rounded-full transition-colors"
            style={{
              color: 'var(--text-muted)',
              '--hover-bg': 'var(--bg-tertiary)',
              '--hover-color': 'var(--text-primary)'
            } as React.CSSProperties}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)';
              e.currentTarget.style.color = 'var(--text-primary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = 'var(--text-muted)';
            }}
            title="Add emoji"
          >
            <Smile className="w-5 h-5" />
          </button>

          {/* Emoji Picker */}
          {showEmojiPicker && (
            <div
              ref={emojiPickerRef}
              className="absolute bottom-full right-0 mb-2 z-50 shadow-2xl rounded-xl overflow-hidden"
            >
              <EmojiPicker
                onEmojiClick={handleEmojiClick}
                width={300}
                height={350}
                previewConfig={{ showPreview: false }}
                skinTonesDisabled
                theme={darkMode ? EmojiTheme.DARK : EmojiTheme.LIGHT}
              />
            </div>
          )}
        </div>

        {/* Voice Record Button */}
        {onVoiceRecord && !input.trim() && !selectedFile && (
          <button
            onClick={startRecording}
            disabled={disabled}
            className="p-3 rounded-full transition-all duration-200 shrink-0"
            style={{
              backgroundColor: 'var(--bg-secondary)',
              color: 'var(--text-muted)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)';
              e.currentTarget.style.color = 'var(--text-primary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--bg-secondary)';
              e.currentTarget.style.color = 'var(--text-muted)';
            }}
            title="Record voice message"
          >
            <Mic className="w-5 h-5" />
          </button>
        )}

        {/* Send Button */}
        {(input.trim() || selectedFile) && (
          <button
            onClick={handleSend}
            disabled={disabled || isUploading}
            className={`p-3 rounded-full transition-all duration-200 shrink-0 ${!disabled && !isUploading
              ? 'bg-blue-500 hover:bg-blue-600 text-white shadow-md hover:shadow-lg transform hover:scale-105'
              : 'cursor-not-allowed'
              }`}
            style={disabled || isUploading ? {
              backgroundColor: 'var(--bg-tertiary)',
              color: 'var(--text-muted)'
            } : {}}
          >
            <Send className="w-5 h-5" />
          </button>
        )}
      </div>
    </div>
  );
};

export default MessageInput;