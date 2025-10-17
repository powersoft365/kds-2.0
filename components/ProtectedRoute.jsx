// /components/ProtectedRoute.jsx
"use client";
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import GlobalLoader from '@/components/ui/GlobalLoader';

export default function ProtectedRoute({ children }) {
    const { isAuthenticated, isLoading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        // If not loading and not authenticated, redirect to login
        if (!isLoading && !isAuthenticated) {
            router.replace('/login');
        }
    }, [isAuthenticated, isLoading, router]);

    // While checking auth, show a loader
    if (isLoading) {
        return <GlobalLoader text="Authenticating..." />;
    }

    // If authenticated, show the children
    if (isAuthenticated) {
      return children;
    }
    
    // If not authenticated (and not loading), return null to prevent flash of content
    return null;
}