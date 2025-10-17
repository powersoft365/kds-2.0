"use client";
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import ButtonSpinner from '@/components/ui/ButtonSpinner';

/**
 * A simple skeleton loader component for form elements.
 */
const SkeletonInput = () => (
    <div className="w-full h-11 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
);


export default function SelectContextPage() {
    const { user, establishSession } = useAuth();
    const router = useRouter();
    
    // A single status state is cleaner than multiple boolean flags
    const [status, setStatus] = useState('loadingCompanies'); // loadingCompanies, loadingDatabases, ready, submitting
    
    const [companies, setCompanies] = useState([]);
    const [selectedCompany, setSelectedCompany] = useState('');
    const [databases, setDatabases] = useState([]);
    const [selectedDatabase, setSelectedDatabase] = useState('');
    const [error, setError] = useState('');

    useEffect(() => {
        // If the AuthContext has not yet confirmed the user, wait.
        if (!user) {
            // A useEffect in AuthContext handles redirecting if the session is invalid.
            // This check prevents fetching if the user object isn't loaded yet.
            return;
        }

        const fetchCompanies = async () => {
            setStatus('loadingCompanies');
            try {
                const res = await fetch('/api/auth/companies', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username: user.username }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.message);
                setCompanies(data);
                setStatus('ready');
            } catch (err) {
                setError(err.message);
                setStatus('error');
            }
        };
        fetchCompanies();
    }, [user]);

    useEffect(() => {
        if (!selectedCompany || !user) {
            setDatabases([]);
            setSelectedDatabase('');
            return;
        }
        
        const fetchDatabases = async () => {
            setStatus('loadingDatabases');
            setError('');
            try {
                const res = await fetch('/api/auth/databases', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username: user.username, companyId: selectedCompany }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.message);
                setDatabases(data);
                setStatus('ready');
            } catch (err) {
                setError(err.message);
                setStatus('error');
            }
        };
        fetchDatabases();
    }, [selectedCompany, user]);
    
    const handleProceed = async () => {
        if (!selectedCompany || !selectedDatabase) {
            setError('Please select a company and a database.');
            return;
        }
        
        setStatus('submitting');
        setError('');
        
        try {
            await establishSession(selectedDatabase);
            router.replace('/'); // Redirect to the main KDS page
        } catch (err) {
            setError(err.message || 'Failed to establish session.');
            setStatus('ready'); // Reset status on failure
        }
    };
    
    const renderContent = () => {
        if (status === 'loadingCompanies') {
            return (
                <div className="space-y-4">
                    <SkeletonInput />
                    <SkeletonInput />
                    <div className="w-full h-10 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse mt-6" />
                </div>
            );
        }

        return (
            <div className="space-y-4">
                <div>
                    <label className="block text-gray-700 dark:text-gray-300 mb-2" htmlFor="company">Company</label>
                    <select
                        id="company"
                        value={selectedCompany}
                        onChange={(e) => setSelectedCompany(e.target.value)}
                        className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 dark:bg-gray-800 dark:border-gray-600"
                    >
                        <option value="">Select a company</option>
                        {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                </div>

                <div>
                    <label className="block text-gray-700 dark:text-gray-300 mb-2" htmlFor="database">Database</label>
                    <select
                        id="database"
                        value={selectedDatabase}
                        onChange={(e) => setSelectedDatabase(e.target.value)}
                        disabled={!selectedCompany || status === 'loadingDatabases'}
                        className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 dark:bg-gray-800 dark:border-gray-600 disabled:bg-gray-200 dark:disabled:bg-gray-700 disabled:cursor-not-allowed"
                    >
                        <option value="">{status === 'loadingDatabases' ? 'Loading...' : 'Select a database'}</option>
                        {databases.map(db => <option key={db.id} value={db.id}>{db.name}</option>)}
                    </select>
                </div>
                
                {error && <p className="text-red-500 text-sm text-center pt-2">{error}</p>}
                
                <button
                    onClick={handleProceed}
                    disabled={!selectedDatabase || status !== 'ready'}
                    className="w-full flex items-center justify-center bg-emerald-600 text-white py-2.5 rounded-lg hover:bg-emerald-700 disabled:bg-emerald-400 dark:disabled:bg-emerald-800 disabled:cursor-not-allowed transition-colors mt-6"
                >
                    {status === 'submitting' && <ButtonSpinner />}
                    {status === 'submitting' ? 'Initializing...' : 'Proceed to KDS'}
                </button>
            </div>
        );
    }

    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900">
            <div className="p-8 bg-white dark:bg-gray-800 rounded-lg shadow-md w-full max-w-md">
                <h1 className="text-2xl font-bold mb-6 text-center text-gray-800 dark:text-gray-100">Select Context</h1>
                {renderContent()}
            </div>
        </div>
    );
}