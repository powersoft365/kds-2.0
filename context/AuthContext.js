"use client";
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isLoading, setIsLoading] = useState(true); // Start loading until we check auth
    // Persist password in memory only for the duration of the auth flow.
    const [tempPassword, setTempPassword] = useState(null); 
    const router = useRouter();

    // This function will check the server-side session
    const checkAuth = useCallback(async () => {
        setIsLoading(true);
        try {
            const res = await fetch('/api/auth/me');
            const data = await res.json();
            setIsAuthenticated(data.isAuthenticated);
        } catch {
            setIsAuthenticated(false);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        checkAuth();
    }, [checkAuth]);

    const login = async (username, password) => {
        const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message);

        setUser(data.user);
        setTempPassword(password); // Store password temporarily
    };
    
    const establishSession = async (selectedDatabaseId) => {
        if (!user || !tempPassword) {
            throw new Error("User credentials are not available.");
        }
        const res = await fetch('/api/auth/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                databaseId: selectedDatabaseId,
                username: user.username,
                password: tempPassword,
            }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message);
        
        // Session is now created on the server. Update client state.
        setIsAuthenticated(true);
        setTempPassword(null); // Clear the temporary password from memory
    };

    const logout = async () => {
        await fetch('/api/auth/logout', { method: 'POST' });
        setUser(null);
        setIsAuthenticated(false);
        setTempPassword(null);
        router.push('/login');
    };

    const value = { user, isAuthenticated, isLoading, login, establishSession, logout };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};