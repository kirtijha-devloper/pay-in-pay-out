import React, { useState, useEffect, useRef } from 'react';
import api from '../../lib/api';
import { Search, User, X, Loader2 } from 'lucide-react';

const UserSearch = ({ onSelect, onQueryChange, placeholder = 'Search user by name, email or mobile...', className = '' }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);
  const timeoutRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const searchUsers = async (q) => {
    if (!q.trim()) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data } = await api.get(`/users/search?q=${encodeURIComponent(q)}`);
      if (data.success) {
        setResults(data.users);
        setIsOpen(true);
      }
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    if (onQueryChange) onQueryChange(val);

    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    
    if (val.trim()) {
      timeoutRef.current = setTimeout(() => {
        searchUsers(val);
      }, 300);
    } else {
      setResults([]);
      setIsOpen(false);
    }
  };

  const handleSelect = (user) => {
    setQuery(user?.ownerName || user?.email || '');
    setIsOpen(false);
    setResults([]);
    onSelect(user);
  };

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <div className="relative group">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400 group-focus-within:text-primary transition-colors">
          <Search size={18} />
        </div>
        <input
          type="text"
          value={query}
          onChange={handleInputChange}
          onFocus={() => query.trim() && results.length > 0 && setIsOpen(true)}
          placeholder={placeholder}
          className="form-input pl-10 pr-10"
        />
        {(query || loading) && (
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
            {loading ? (
              <Loader2 size={16} className="animate-spin text-primary" />
            ) : (
              <button 
                type="button"
                onClick={() => { 
                  setQuery(''); 
                  setResults([]); 
                  setIsOpen(false); 
                  if (onSelect) onSelect(null);
                }} 
                className="p-1 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={16} />
              </button>
            )}
          </div>
        )}
      </div>

      {isOpen && results.length > 0 && (
        <div className="absolute mt-2 w-full bg-white rounded-xl shadow-2xl border border-gray-100 z-[100] max-h-80 overflow-y-auto animate-slide-up">
          <div className="p-3 border-b border-gray-50 bg-gray-50/50">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">Suggested Users</span>
          </div>
          <div className="py-1">
            {results.map((user) => (
              <button
                key={user.id}
                onClick={() => handleSelect(user)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-primary-light transition-colors text-left group/item"
              >
                <div className="w-10 h-10 rounded-full bg-primary-light flex items-center justify-center text-primary group-hover/item:bg-primary group-hover/item:text-white transition-all duration-300">
                  <User size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-900 truncate group-hover/item:text-primary transition-colors">
                      {user.ownerName || user.shopName || 'Unknown'}
                    </span>
                    <span className="px-1.5 py-0.5 bg-gray-100 text-[10px] font-bold rounded-md text-gray-500 uppercase">
                      {user.role}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 truncate">{user.email}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {isOpen && query.trim() && !loading && results.length === 0 && (
        <div className="absolute mt-2 w-full bg-white rounded-xl shadow-2xl border border-gray-100 z-[100] p-10 text-center animate-slide-up">
          <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <Search size={32} className="text-gray-300" strokeWidth={1.5} />
          </div>
          <div className="text-sm font-semibold text-gray-900">No users found</div>
          <div className="text-xs text-gray-500 mt-1 max-w-[200px] mx-auto">
            We couldn't find any users in your hierarchy matching "{query}"
          </div>
        </div>
      )}
    </div>
  );
};

export default UserSearch;
